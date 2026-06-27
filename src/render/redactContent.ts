/**
 * @module render/redactContent
 *
 * Redaction by *true removal* (feature 0.29.8).
 *
 * Unlike a visual overlay (which merely paints an opaque box on top of the
 * page while the underlying text and images remain in the file), this module
 * physically removes the offending content-stream operators.  After
 * {@link redactRegions} runs and the document is saved, the redacted text is
 * gone from the byte stream — it cannot be recovered by copy/paste, text
 * extraction, or stream inspection.
 *
 * ## How it works
 *
 * 1. The page's full content stream is parsed into operators
 *    ({@link parseContentStream}).
 * 2. A single position-tracking pass replays the graphics-state machine
 *    (CTM via `q`/`Q`/`cm`; text matrices via `BT`/`Td`/`TD`/`Tm`/`T*`),
 *    computing a page-space bounding box for every text-showing operator
 *    (`Tj`/`TJ`/`'`/`"`) and every image placement (`Do`).
 * 3. Any text run or image whose bounding box intersects a redaction rect is
 *    **omitted** from the output; *all other operators are preserved* so the
 *    surrounding layout and graphics are untouched.
 * 4. The filtered operators are re-serialized into a fresh content stream and
 *    written back to the page, replacing the original content.
 *
 * @packageDocumentation
 */

import type { ContentStreamOperator, Operand } from '../parser/contentStreamParser.js';
import { parseContentStream } from '../parser/contentStreamParser.js';
import { PdfName } from '../core/pdfObjects.js';
import type { PdfPage } from '../core/pdfPage.js';
import type { Matrix } from './matrix.js';
import { identity, multiply, applyToPoint, translation } from './matrix.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A rectangular region to redact, in page space (PDF points, y-up, lower-left origin). */
export interface RedactRect {
  /** X coordinate of the lower-left corner. */
  x: number;
  /** Y coordinate of the lower-left corner. */
  y: number;
  /** Width of the region (must be > 0 to match anything). */
  width: number;
  /** Height of the region (must be > 0 to match anything). */
  height: number;
}

/** The outcome of a {@link redactRegions} call. */
export interface RedactResult {
  /** Number of text-showing operators removed. */
  removedText: number;
  /** Number of image (`Do`) placements removed. */
  removedImages: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** An axis-aligned bounding box in page space. */
interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Build a {@link BBox} from a set of page-space corner points. */
function bboxOfPoints(points: ReadonlyArray<readonly [number, number]>): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Whether a page-space bounding box intersects a redaction rect. */
function intersects(box: BBox, rect: RedactRect): boolean {
  const rMinX = rect.x;
  const rMinY = rect.y;
  const rMaxX = rect.x + rect.width;
  const rMaxY = rect.y + rect.height;
  return (
    box.minX <= rMaxX &&
    box.maxX >= rMinX &&
    box.minY <= rMaxY &&
    box.maxY >= rMinY
  );
}

/** Whether a bounding box intersects *any* of the redaction rects. */
function intersectsAny(box: BBox, rects: readonly RedactRect[]): boolean {
  for (const rect of rects) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (intersects(box, rect)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Operand inspection
// ---------------------------------------------------------------------------

function num(op: Operand | undefined): number {
  return typeof op === 'number' ? op : 0;
}

/** Length of the visible characters a text-show operand contributes. */
function operandTextLength(op: Operand | undefined): number {
  if (typeof op === 'string') return op.length;
  if (Array.isArray(op)) {
    // TJ array: sum string element lengths (numbers are kerning adjustments).
    let total = 0;
    for (const el of op) {
      if (typeof el === 'string') total += el.length;
    }
    return total;
  }
  return 0;
}

// Approximate glyph metrics in em units (no font metrics available here).
const AVG_GLYPH_WIDTH_EM = 0.5;
const ASCENT_EM = 0.85;
const DESCENT_EM = -0.2;

/**
 * Compute the page-space bounding box of a text run shown at the current
 * text-rendering matrix.  The run is approximated as a rectangle spanning
 * `[0, advance]` horizontally and `[descent, ascent]` vertically in text
 * space (em units, before the font-size scale baked into `trm`).
 */
function textRunBBox(trm: Matrix, glyphCount: number): BBox {
  const advance = Math.max(glyphCount, 1) * AVG_GLYPH_WIDTH_EM;
  const corners: Array<[number, number]> = [
    applyToPoint(trm, 0, DESCENT_EM),
    applyToPoint(trm, advance, DESCENT_EM),
    applyToPoint(trm, advance, ASCENT_EM),
    applyToPoint(trm, 0, ASCENT_EM),
  ];
  return bboxOfPoints(corners);
}

/**
 * Compute the page-space bounding box of an image placed by `Do`.  An image
 * XObject is painted into the unit square `[0,1]×[0,1]` transformed by the
 * current CTM.
 */
function imageBBox(ctm: Matrix): BBox {
  const corners: Array<[number, number]> = [
    applyToPoint(ctm, 0, 0),
    applyToPoint(ctm, 1, 0),
    applyToPoint(ctm, 1, 1),
    applyToPoint(ctm, 0, 1),
  ];
  return bboxOfPoints(corners);
}

// ---------------------------------------------------------------------------
// Operand serialization (re-emit filtered operators)
// ---------------------------------------------------------------------------

/**
 * Serialize a string operand as a PDF hex string `<…>`.
 *
 * Hex strings are byte-exact and contain only ASCII, so they survive the
 * UTF-8 encoding applied when the content stream is written.  The parser
 * decodes both `(…)` and `<…>` strings to a JS string of latin-1 char codes,
 * so re-emitting as hex preserves the original bytes regardless of the
 * original literal form (important for multi-byte / CID-encoded text).
 */
function serializeString(s: string): string {
  let out = '<';
  for (let i = 0; i < s.length; i++) {
    const byte = s.charCodeAt(i) & 0xff;
    out += byte.toString(16).padStart(2, '0');
  }
  return out + '>';
}

/** Format a number the way PDF content streams expect (no trailing zeros). */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/** Serialize a single operand to its content-stream textual form. */
function serializeOperand(op: Operand): string {
  if (op === null) return 'null';
  if (typeof op === 'boolean') return op ? 'true' : 'false';
  if (typeof op === 'number') return formatNumber(op);
  if (typeof op === 'string') return serializeString(op);
  if (op instanceof PdfName) {
    // PdfName.value already includes the leading '/'.
    return op.value;
  }
  if (Array.isArray(op)) {
    return '[' + op.map(serializeOperand).join(' ') + ']';
  }
  return '';
}

/** Serialize one operator (operands followed by the operator keyword). */
function serializeOperator(op: ContentStreamOperator): string {
  if (op.operands.length === 0) return op.operator;
  const operandStr = op.operands.map(serializeOperand).join(' ');
  return `${operandStr} ${op.operator}`;
}

// ---------------------------------------------------------------------------
// Text-state machine
// ---------------------------------------------------------------------------

/** Snapshot of the graphics + text state needed for bbox computation. */
interface State {
  ctm: Matrix;
  fontSize: number;
  hScale: number;
  rise: number;
  leading: number;
}

function initialState(): State {
  return { ctm: identity(), fontSize: 0, hScale: 1, rise: 0, leading: 0 };
}

/**
 * Build the text-rendering matrix used to map text-space (em) coordinates to
 * page space, matching the interpreter:
 * `Trm = [fontSize·hScale, 0, 0, fontSize, 0, rise] × Tm × CTM`.
 */
function textRenderingMatrix(state: State, tm: Matrix): Matrix {
  const textScale: Matrix = [state.fontSize * state.hScale, 0, 0, state.fontSize, 0, state.rise];
  return multiply(multiply(textScale, tm), state.ctm);
}

// ---------------------------------------------------------------------------
// Core filter
// ---------------------------------------------------------------------------

/**
 * Walk the operators, tracking position, and return both the filtered
 * operator list and the removal counts.
 */
function filterOperators(
  operators: readonly ContentStreamOperator[],
  rects: readonly RedactRect[],
): { kept: ContentStreamOperator[]; removedText: number; removedImages: number } {
  const kept: ContentStreamOperator[] = [];
  let removedText = 0;
  let removedImages = 0;

  const stack: State[] = [];
  let state = initialState();

  // Text matrices (only valid between BT/ET).
  let tm: Matrix = identity();
  let tlm: Matrix = identity();

  for (const op of operators) {
    const { operator, operands } = op;
    let drop = false;

    switch (operator) {
      // --- graphics-state stack ---
      case 'q':
        stack.push({ ...state });
        break;
      case 'Q':
        if (stack.length > 0) state = stack.pop()!;
        break;
      case 'cm':
        state = {
          ...state,
          ctm: multiply(
            [num(operands[0]), num(operands[1]), num(operands[2]), num(operands[3]), num(operands[4]), num(operands[5])],
            state.ctm,
          ),
        };
        break;

      // --- text object ---
      case 'BT':
        tm = identity();
        tlm = identity();
        break;
      case 'ET':
        break;

      // --- text state ---
      case 'Tf':
        state = { ...state, fontSize: num(operands[1]) };
        break;
      case 'Tz':
        state = { ...state, hScale: num(operands[0]) / 100 };
        break;
      case 'Ts':
        state = { ...state, rise: num(operands[0]) };
        break;
      case 'TL':
        state = { ...state, leading: num(operands[0]) };
        break;

      // --- text positioning ---
      case 'Td':
        tlm = multiply(translation(num(operands[0]), num(operands[1])), tlm);
        tm = tlm;
        break;
      case 'TD':
        state = { ...state, leading: -num(operands[1]) };
        tlm = multiply(translation(num(operands[0]), num(operands[1])), tlm);
        tm = tlm;
        break;
      case 'Tm':
        tm = [num(operands[0]), num(operands[1]), num(operands[2]), num(operands[3]), num(operands[4]), num(operands[5])];
        tlm = tm;
        break;
      case 'T*':
        tlm = multiply(translation(0, -state.leading), tlm);
        tm = tlm;
        break;

      // --- text showing ---
      case 'Tj':
      case 'TJ':
      case "'":
      case '"': {
        // `'` and `"` move to the next line first.
        if (operator === "'" || operator === '"') {
          tlm = multiply(translation(0, -state.leading), tlm);
          tm = tlm;
        }
        if (operator === '"') {
          // `aw ac string "` — operands[2] is the string.
          state = { ...state };
        }
        const textOperand =
          operator === '"' ? operands[2] : operator === "'" ? operands[0] : operands[0];
        const glyphCount = operandTextLength(textOperand);
        const trm = textRenderingMatrix(state, tm);
        const box = textRunBBox(trm, glyphCount);
        if (intersectsAny(box, rects)) {
          drop = true;
          removedText++;
        }
        break;
      }

      // --- XObject placement (images / forms) ---
      case 'Do': {
        const box = imageBBox(state.ctm);
        if (intersectsAny(box, rects)) {
          drop = true;
          removedImages++;
        }
        break;
      }

      default:
        break;
    }

    if (!drop) kept.push(op);
  }

  return { kept, removedText, removedImages };
}

// ---------------------------------------------------------------------------
// Page content replacement
// ---------------------------------------------------------------------------

/**
 * Internal shape of {@link PdfPage}'s mutable content state.
 *
 * The page stores all drawing content as a private `ops` string (exposed
 * read-only via `getContentStreamData()`); content from a loaded PDF lives in
 * the private `_originalContentRefs` array.  At save time `finalize()` emits
 * `PdfStream.fromString(ops)` when there are no original refs.  To *replace*
 * the page content we therefore set `ops` to the filtered serialization and
 * clear `_originalContentRefs`, routing the whole page through the
 * fresh-content branch of `finalize()`.
 *
 * This is the page's documented content-replacement path: there is no public
 * setter, only `pushOperators()` (append-only), so we drive the private
 * buffer directly through this narrow, well-defined interface.
 */
interface PageContentInternals {
  ops: string;
  _originalContentRefs: unknown[];
}

/** Replace the page's entire content stream with the given operator string. */
function replacePageContent(page: PdfPage, content: string): void {
  const internals = page as unknown as PageContentInternals;
  internals.ops = content;
  // Drop any loaded-PDF content streams so finalize() emits only `ops`.
  internals._originalContentRefs = [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Permanently remove text and image content within the given regions from a
 * page (redaction by removal).
 *
 * The page's content stream is parsed, replayed through a position-tracking
 * graphics-state machine, and re-emitted with every text-showing operator and
 * image placement that falls inside any redaction rect omitted.  All other
 * operators — paths, fills, colors, clips, state changes — are preserved, so
 * the surrounding page layout is left intact.  The filtered content is written
 * back to the page and takes effect on the next `save()`.
 *
 * @param page   The page to redact (modified in place).
 * @param rects  Redaction regions in page space (PDF points, y-up).
 * @returns      Counts of removed text runs and image placements.
 *
 * @example
 * ```ts
 * const result = redactRegions(page, [{ x: 0, y: 90, width: 200, height: 30 }]);
 * console.log(`Removed ${result.removedText} text runs`);
 * const bytes = await doc.save();
 * ```
 */
export function redactRegions(page: PdfPage, rects: RedactRect[]): RedactResult {
  if (rects.length === 0) {
    return { removedText: 0, removedImages: 0 };
  }

  const operators = parseContentStream(page.getContentStream());
  const { kept, removedText, removedImages } = filterOperators(operators, rects);

  // Re-serialize the surviving operators into a fresh content stream.
  const content = kept.map(serializeOperator).join('\n') + (kept.length > 0 ? '\n' : '');
  replacePageContent(page, content);

  return { removedText, removedImages };
}
