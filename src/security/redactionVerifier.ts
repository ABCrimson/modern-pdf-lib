/**
 * @module security/redactionVerifier
 *
 * Detect FAILED / fake redactions — text that is still extractable underneath
 * a redaction region.
 *
 * A *secure* redaction physically removes the underlying text-showing
 * operators from the page content stream (see `redactRegions` in
 * `../render/redactContent.js`), so the redacted text cannot be recovered by
 * copy/paste, text extraction, or raw stream inspection.  A *fake* redaction
 * merely paints an opaque black box on top of the page while the original text
 * remains in the byte stream — a genuine, well-documented security failure
 * (the "select-all-and-copy" leak).  This verifier finds those leaks.
 *
 * ## How it works
 *
 * For each page named by a region:
 * 1. The page's content stream is decoded
 *    (`PdfPage.getContentStream()`) and parsed (`parseContentStream`).
 * 2. `extractTextWithPositions` replays the text/graphics-state machine and
 *    yields one positioned {@link import('../parser/textExtractor.js').TextItem}
 *    per shown text run, with its page-space origin and size.
 * 3. Every text item whose bounding box intersects a region rectangle is
 *    reported as a leak.  `clean` is true iff there are no leaks.
 *
 * ## Coordinate / encoding conventions (confirmed, not assumed)
 *
 * - **Space:** PDF user space — the coordinate space produced by
 *   `extractTextWithPositions`.  Origin is **bottom-left**, the y-axis points
 *   **up**, and units are **PDF points** (1/72 inch).  This matches
 *   `RedactRect` in `../render/redactContent.js` ("page space, PDF points,
 *   y-up, lower-left origin"), so a {@link RedactionRegion} uses exactly the
 *   same convention: `(x, y)` is the lower-left corner and `width` / `height`
 *   extend in the +x / +y directions.
 * - **Glyph box:** a `TextItem` reports `(x, y)` = the text origin
 *   (baseline-left), `width` extending +x, and `height` (equal to the font
 *   size) extending +y.  The run's axis-aligned box is therefore
 *   `[x, y, x + width, y + height]`.  Note `width`/`height` are heuristic
 *   estimates from `extractTextWithPositions` (0.5·fontSize per character;
 *   height = fontSize) because per-glyph font metrics are not available there;
 *   intersection testing tolerates this by treating any overlap as a leak.
 * - **Text decoding:** strings are decoded by `extractTextWithPositions` using
 *   the font's `/ToUnicode` CMap when present, else WinAnsiEncoding (1-byte) or
 *   2-byte Identity-H for CID fonts — see `../parser/textExtractor.js`.
 *
 * ## Region auto-detection is intentionally NOT performed
 *
 * The `regions` argument is **required**.  Deriving candidate regions from the
 * PDF itself is not reliable through the public API and is not fabricated here:
 *   - Filled black rectangles in the content stream are indistinguishable from
 *     legitimate black-filled graphics (chart bars, rules, design elements), so
 *     a heuristic would produce false positives/negatives.
 *   - `/Redact` annotations (ISO 32000-2 §12.5.6.23) *do* carry explicit
 *     `/Rect` / `/QuadPoints` regions, but a loaded page's original annotation
 *     dictionaries are not exposed through a stable public `PdfPage` accessor,
 *     so reading them here is not possible without reaching into private state.
 * Callers must therefore pass the regions they redacted (or believe were
 * redacted).  When `regions` is omitted or empty, {@link verifyRedactions}
 * throws.
 *
 * @packageDocumentation
 */

import { loadPdf } from '../parser/documentParser.js';
import { parseContentStream } from '../parser/contentStreamParser.js';
import { extractTextWithPositions } from '../parser/textExtractor.js';
import type { TextItem } from '../parser/textExtractor.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A rectangular region to check for redaction leaks.
 *
 * Coordinates are in PDF user space: origin bottom-left, y-up, units in PDF
 * points.  `(x, y)` is the **lower-left** corner; `width` and `height` extend
 * in the +x and +y directions.  This is the same convention as `RedactRect`
 * in `../render/redactContent.js`.
 */
export interface RedactionRegion {
  /** Zero-based page index this region applies to. */
  page: number;
  /** X coordinate of the lower-left corner, in PDF points. */
  x: number;
  /** Y coordinate of the lower-left corner, in PDF points. */
  y: number;
  /** Width of the region in PDF points (must be > 0 to match anything). */
  width: number;
  /** Height of the region in PDF points (must be > 0 to match anything). */
  height: number;
}

/**
 * A single piece of text found still present under a redaction region — i.e. a
 * redaction that did not actually remove the underlying content.
 */
export interface RedactionLeak {
  /** Zero-based page index where the leak was found. */
  page: number;
  /** The still-extractable text (decoded to Unicode). */
  text: string;
  /** Text-origin X of the leaking run (bottom-left, y-up), in PDF points. */
  x: number;
  /** Text-origin Y of the leaking run (bottom-left, y-up), in PDF points. */
  y: number;
}

/** The outcome of a {@link verifyRedactions} call. */
export interface RedactionVerificationReport {
  /** Every text run found still present under a region. */
  leaks: RedactionLeak[];
  /** True iff {@link leaks} is empty (no failed redactions detected). */
  clean: boolean;
  /** Number of regions that were checked. */
  regionsChecked: number;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Axis-aligned bounding box of a text run in page space (bottom-left origin).
 * `width`/`height` may be zero (empty text); such runs never intersect.
 */
function itemBox(item: TextItem): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  // `width`/`height` are non-negative estimates; normalize defensively in case
  // a transform produced a negative extent.
  const x0 = item.x;
  const y0 = item.y;
  const x1 = item.x + item.width;
  const y1 = item.y + item.height;
  return {
    minX: Math.min(x0, x1),
    minY: Math.min(y0, y1),
    maxX: Math.max(x0, x1),
    maxY: Math.max(y0, y1),
  };
}

/**
 * Whether a text run's box overlaps a region rectangle.
 *
 * Uses the standard separating-axis test for axis-aligned rectangles: they
 * overlap unless one is entirely to the left/right/above/below the other.
 * Touching edges count as overlap (inclusive bounds), matching the intersection
 * test in `../render/redactContent.js`.
 */
function intersects(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  region: RedactionRegion,
): boolean {
  const rMinX = region.x;
  const rMinY = region.y;
  const rMaxX = region.x + region.width;
  const rMaxY = region.y + region.height;
  return (
    box.minX <= rMaxX &&
    box.maxX >= rMinX &&
    box.minY <= rMaxY &&
    box.maxY >= rMinY
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify that the given regions of a PDF contain no still-extractable text,
 * detecting fake / failed redactions.
 *
 * For each region, the corresponding page's text is extracted with positions
 * and any text run whose bounding box intersects the region is reported as a
 * {@link RedactionLeak}.  A clean result means no text was found under any
 * region (the redactions truly removed the content, or there was none to begin
 * with).
 *
 * @param pdf      The PDF file bytes to inspect.
 * @param regions  The regions to check (REQUIRED — see the module docs for why
 *                 automatic region detection is not performed).  Coordinates are
 *                 in PDF user space: origin bottom-left, y-up, units in points;
 *                 `(x, y)` is the lower-left corner.
 * @returns        A report listing every leak; `clean` is true iff there are
 *                 none.
 * @throws         `TypeError` if `regions` is omitted or empty.
 *
 * @example
 * ```ts
 * const report = await verifyRedactions(pdfBytes, [
 *   { page: 0, x: 45, y: 545, width: 120, height: 25 },
 * ]);
 * if (!report.clean) {
 *   for (const leak of report.leaks) {
 *     console.warn(`Leak on page ${leak.page}: "${leak.text}"`);
 *   }
 * }
 * ```
 */
export async function verifyRedactions(
  pdf: Uint8Array,
  regions?: readonly RedactionRegion[],
): Promise<RedactionVerificationReport> {
  if (regions === undefined || regions.length === 0) {
    throw new TypeError(
      'verifyRedactions requires an explicit, non-empty `regions` array. ' +
        'Automatic redaction-region detection is not performed: black-filled ' +
        'rectangles are indistinguishable from legitimate graphics, and a ' +
        "loaded page's original /Redact annotations are not exposed through a " +
        'stable public API. Pass the regions you redacted (PDF points, ' +
        'bottom-left origin, y-up).',
    );
  }

  const doc = await loadPdf(pdf);
  const pageCount = doc.getPageCount();

  // Cache positioned text items per page so multiple regions on the same page
  // only parse + extract once.
  const itemsByPage = new Map<number, readonly TextItem[]>();

  const getItems = (pageIndex: number): readonly TextItem[] => {
    const cached = itemsByPage.get(pageIndex);
    if (cached !== undefined) return cached;

    let items: readonly TextItem[] = [];
    if (pageIndex >= 0 && pageIndex < pageCount) {
      const page = doc.getPage(pageIndex);
      const content = page.getContentStream();
      const operators = parseContentStream(content);
      // Pass the page's original /Resources so font encodings / ToUnicode CMaps
      // are used to decode the text correctly.
      const resources = page.getOriginalResources();
      items = extractTextWithPositions(operators, resources);
    }
    itemsByPage.set(pageIndex, items);
    return items;
  };

  const leaks: RedactionLeak[] = [];

  for (const region of regions) {
    // A degenerate region (no area) cannot cover anything.
    if (region.width <= 0 || region.height <= 0) continue;

    const items = getItems(region.page);
    for (const item of items) {
      if (item.text.length === 0) continue;
      const box = itemBox(item);
      // Zero-area glyph boxes (empty estimate) cannot leak.
      if (box.maxX === box.minX && box.maxY === box.minY) continue;
      if (intersects(box, region)) {
        leaks.push({
          page: region.page,
          text: item.text,
          x: item.x,
          y: item.y,
        });
      }
    }
  }

  return {
    leaks,
    clean: leaks.length === 0,
    regionsChecked: regions.length,
  };
}
