/**
 * @module accessibility/autoTag
 *
 * Heuristic structure inference for an **untagged** PDF page.
 *
 * Auto-tagging examines the positioned text of a page (via the content
 * stream interpreter) and infers a coarse logical structure: which runs
 * are headings (and at what level) and which are body paragraphs.  It
 * then populates the document's structure tree with `H1`..`H6` and `P`
 * elements in reading order.
 *
 * **This is a heuristic, not a semantic, process.** It infers structure
 * purely from typography — font size relative to the body text size and
 * vertical position — with no understanding of meaning.  The result is a
 * reasonable starting point for an accessible (tagged) document, not a
 * substitute for authored structure.  Headings are detected when a run's
 * font size meets or exceeds {@link AutoTagOptions.headingScale} times the
 * inferred body size; the largest heading size maps to `H1`, the next to
 * `H2`, and so on (capped at `H6`).
 *
 * @example
 * ```ts
 * import { loadPdf } from 'modern-pdf-lib';
 * import { autoTagPage } from 'modern-pdf-lib/accessibility';
 *
 * const doc = await loadPdf(bytes);
 * const { headings, paragraphs } = autoTagPage(doc, 0);
 * console.log(`Tagged ${headings} headings and ${paragraphs} paragraphs`);
 * ```
 */

import type { PdfDocument } from '../core/pdfDocument.js';
import { interpretPage } from '../render/interpreter.js';
import type { TextItem } from '../render/displayList.js';
import type { StructureType } from './structureTree.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Options controlling heuristic auto-tagging.
 */
export interface AutoTagOptions {
  /**
   * A text run whose font size is `>= headingScale × bodySize` is treated
   * as a heading.  The body size is the most common (median) font size on
   * the page.  Defaults to `1.2` (a run 20% larger than body text is a
   * heading).
   */
  headingScale?: number | undefined;
}

/**
 * Summary of what {@link autoTagPage} inferred and added to the structure
 * tree.
 */
export interface AutoTagResult {
  /** Number of heading (`H1`..`H6`) elements added. */
  headings: number;
  /** Number of paragraph (`P`) elements added. */
  paragraphs: number;
  /** Total number of structure elements added (headings + paragraphs). */
  elements: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default heading-detection scale relative to body text size. */
const DEFAULT_HEADING_SCALE = 1.2;

/**
 * Maximum vertical gap (in page-space units, as a fraction of the run's
 * font size) within which two text runs are considered to belong to the
 * same visual line.  Runs whose baselines are within this fraction of an
 * em are merged onto one line.
 */
const SAME_LINE_FRACTION = 0.5;

/** Highest heading level tag supported. */
const MAX_HEADING_LEVEL = 6;

// ---------------------------------------------------------------------------
// Internal line model
// ---------------------------------------------------------------------------

/**
 * A single inferred line of text: a group of runs that share a baseline.
 *
 * @internal
 */
interface InferredLine {
  /** Baseline y-position in page space (y-up). */
  readonly y: number;
  /** The dominant (largest) font size among the line's runs. */
  readonly fontSize: number;
  /** Concatenated text of all runs on the line. */
  readonly text: string;
}

// ---------------------------------------------------------------------------
// autoTagPage
// ---------------------------------------------------------------------------

/**
 * Infer a coarse logical structure for a single untagged page and add the
 * inferred `H1`..`H6` and `P` elements to the document's structure tree.
 *
 * The procedure:
 * 1. Interpret the page into positioned text runs.
 * 2. Group runs into visual lines by their baseline y-position.
 * 3. Determine the body font size as the median run font size.
 * 4. Order lines top-to-bottom (reading order on a y-up page).
 * 5. Classify each line as a heading (font size `>= headingScale × body`)
 *    or body text; map distinct heading sizes to `H1`..`H6`
 *    (largest → `H1`).
 * 6. Emit one heading element per heading line and one `P` element per
 *    contiguous block of body lines.
 *
 * Never throws on an empty (or text-free) page — it returns all-zero
 * counts and leaves the structure tree untouched.
 *
 * @param doc        The document containing the page.
 * @param pageIndex  Zero-based index of the page to tag.
 * @param options    Optional heuristic tuning ({@link AutoTagOptions}).
 * @returns          Counts of the elements that were added.
 */
export function autoTagPage(
  doc: PdfDocument,
  pageIndex: number,
  options?: AutoTagOptions,
): AutoTagResult {
  const headingScale = options?.headingScale ?? DEFAULT_HEADING_SCALE;

  // --- 1. Gather positioned text runs from the page. ---
  const textItems = collectTextItems(doc, pageIndex);
  if (textItems.length === 0) {
    return { headings: 0, paragraphs: 0, elements: 0 };
  }

  // --- 2. Group runs into visual lines by baseline. ---
  const lines = groupIntoLines(textItems);
  if (lines.length === 0) {
    return { headings: 0, paragraphs: 0, elements: 0 };
  }

  // --- 3. Determine body size (median font size across runs). ---
  const bodySize = medianFontSize(textItems);

  // --- 4. Reading order: top of page first (descending y on a y-up page). ---
  const ordered = [...lines].sort((a, b) => b.y - a.y);

  // --- 5. Heading size buckets -> levels (largest size = H1). ---
  const headingThreshold = bodySize * headingScale;
  const headingLevelForSize = buildHeadingLevelMap(ordered, headingThreshold);

  // --- 6. Build the structure tree. ---
  const tree = doc.createStructureTree();
  let headings = 0;
  let paragraphs = 0;

  // Body lines are coalesced into a single paragraph until a heading (or
  // the end of the page) breaks the run.
  let paragraphOpen = false;

  for (const line of ordered) {
    if (line.fontSize >= headingThreshold) {
      // A heading closes any open paragraph.
      paragraphOpen = false;
      const level = headingLevelForSize.get(line.fontSize) ?? 1;
      const type: StructureType = `H${level}`;
      tree.addElement(null, type, { title: line.text });
      headings++;
    } else {
      // Body line: start a new paragraph block if one is not open.
      if (!paragraphOpen) {
        tree.addElement(null, 'P');
        paragraphs++;
        paragraphOpen = true;
      }
    }
  }

  return { headings, paragraphs, elements: headings + paragraphs };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Interpret the page and return only its text runs.  Returns an empty
 * array (never throws) if the page cannot be interpreted.
 *
 * @internal
 */
function collectTextItems(doc: PdfDocument, pageIndex: number): TextItem[] {
  const pageCount = doc.getPageCount();
  if (pageIndex < 0 || pageIndex >= pageCount) return [];

  let items: readonly TextItem[] = [];
  try {
    const page = doc.getPage(pageIndex);
    const displayList = interpretPage(page);
    items = displayList.items.filter(
      (it): it is TextItem =>
        it.type === 'text' && it.text.trim().length > 0,
    );
  } catch {
    return [];
  }

  return [...items];
}

/**
 * Group text runs into visual lines by their baseline y-position.
 *
 * The baseline is taken from the run's text-space → page-space transform
 * (`transform[5]`, the `f` translation component).  Runs whose baselines
 * fall within {@link SAME_LINE_FRACTION} of an em of an existing line are
 * merged onto that line; the line's font size is the maximum run size.
 *
 * @internal
 */
function groupIntoLines(items: readonly TextItem[]): InferredLine[] {
  // Process runs top-to-bottom (descending baseline y).
  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5]);

  interface MutableLine {
    y: number;
    fontSize: number;
    text: string;
  }
  const lines: MutableLine[] = [];

  for (const item of sorted) {
    const y = item.transform[5];
    // Use the run's effective vertical scale as its font size when the
    // declared fontSize is missing/zero (defensive).
    const size = item.fontSize > 0
      ? item.fontSize
      : Math.abs(item.transform[3]) || 1;

    const last = lines[lines.length - 1];
    const tolerance = size * SAME_LINE_FRACTION;
    if (last && Math.abs(last.y - y) <= tolerance) {
      // Same visual line: append text, keep the larger size.
      last.text = `${last.text} ${item.text}`.trim();
      if (size > last.fontSize) last.fontSize = size;
    } else {
      lines.push({ y, fontSize: size, text: item.text.trim() });
    }
  }

  return lines.map((l) => ({ y: l.y, fontSize: l.fontSize, text: l.text }));
}

/**
 * Compute the median font size across all text runs.  The median is more
 * robust than the mean against a handful of oversized heading runs, so it
 * gives a reliable estimate of the body text size.
 *
 * @internal
 */
function medianFontSize(items: readonly TextItem[]): number {
  const sizes = items
    .map((it) => (it.fontSize > 0 ? it.fontSize : Math.abs(it.transform[3])))
    .filter((s) => s > 0)
    .sort((a, b) => a - b);

  if (sizes.length === 0) return 1;

  const mid = sizes.length >> 1;
  if (sizes.length % 2 === 1) return sizes[mid]!;
  return (sizes[mid - 1]! + sizes[mid]!) / 2;
}

/**
 * Build a map from each distinct heading font size to a heading level.
 * The largest heading size becomes `H1`, the next-largest `H2`, and so on,
 * capped at {@link MAX_HEADING_LEVEL} (`H6`).
 *
 * @internal
 */
function buildHeadingLevelMap(
  lines: readonly InferredLine[],
  headingThreshold: number,
): Map<number, number> {
  // Distinct heading sizes, largest first.
  const distinct = [
    ...new Set(
      lines
        .filter((l) => l.fontSize >= headingThreshold)
        .map((l) => l.fontSize),
    ),
  ].sort((a, b) => b - a);

  const map = new Map<number, number>();
  distinct.forEach((size, index) => {
    map.set(size, Math.min(index + 1, MAX_HEADING_LEVEL));
  });
  return map;
}
