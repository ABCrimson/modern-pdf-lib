/**
 * @module parser/textExtractor
 *
 * Extract text content from parsed PDF content streams.  Supports both
 * simple text extraction (concatenated strings) and position-aware
 * extraction that tracks the text matrix to compute x/y coordinates.
 *
 * Handles:
 * - All PDF text-showing operators: `Tj`, `TJ`, `'`, `"`
 * - Text-positioning operators: `Td`, `TD`, `Tm`, `T*`
 * - Font selection: `Tf`
 * - Graphics state: `q`/`Q`, `cm`
 * - WinAnsiEncoding (standard single-byte)
 * - Identity-H CID fonts with ToUnicode CMap
 *
 * Reference: PDF 1.7 spec, §9 (Text).
 *
 * @packageDocumentation
 */

import { PdfDict, PdfName, PdfNumber, PdfStream } from '../core/pdfObjects.js';
import type { ContentStreamOperator, Operand } from './contentStreamParser.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single extracted text item with position and font information.
 */
export interface TextItem {
  /** The extracted text string. */
  text: string;
  /** Horizontal position in user-space units. */
  x: number;
  /** Vertical position in user-space units. */
  y: number;
  /** Approximate width of the text in user-space units. */
  width: number;
  /** Approximate height of the text in user-space units (based on font size). */
  height: number;
  /** Font size in user-space units. */
  fontSize: number;
  /** Font resource name (e.g. `"/F1"`). */
  fontName: string;
}

/**
 * Options for text extraction.
 */
export interface TextExtractionOptions {
  /**
   * Include position information.
   * Default: `false` for performance.
   */
  withPositions?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract plain text from a sequence of parsed content-stream operators.
 *
 * This function concatenates all text-showing operator strings, inserting
 * spaces between text objects (BT/ET blocks) and newlines at line breaks
 * (`T*`, `Td`, `TD`).
 *
 * @param operators - Parsed content-stream operators.
 * @param resources - Optional page `/Resources` dictionary (used to look
 *                    up font encodings and ToUnicode CMaps).
 * @param options   - Extraction options.
 * @returns The extracted text as a single string.
 */
export function extractText(
  operators: ContentStreamOperator[],
  resources?: PdfDict,
  options?: TextExtractionOptions,
): string {
  if (options?.withPositions) {
    return extractTextWithPositions(operators, resources)
      .map((item) => item.text)
      .join(' ');
  }

  const state = new TextState(resources);
  const parts: string[] = [];
  let inTextObject = false;
  let lineHasContent = false;

  for (const op of operators) {
    switch (op.operator) {
      case 'BT':
        inTextObject = true;
        state.resetTextMatrix();
        if (parts.length > 0 && lineHasContent) {
          parts.push(' ');
        }
        lineHasContent = false;
        break;

      case 'ET':
        inTextObject = false;
        break;

      case 'Tf':
        state.setFont(
          operandAsString(op.operands[0]),
          operandAsNumber(op.operands[1]),
        );
        break;

      case 'Tc':
        state.charSpacing = operandAsNumber(op.operands[0]);
        break;

      case 'Tw':
        state.wordSpacing = operandAsNumber(op.operands[0]);
        break;

      case 'TL':
        state.leading = operandAsNumber(op.operands[0]);
        break;

      case 'Tz':
        state.horizontalScaling = operandAsNumber(op.operands[0]);
        break;

      case 'Ts':
        state.rise = operandAsNumber(op.operands[0]);
        break;

      case 'Td': {
        const tx = operandAsNumber(op.operands[0]);
        const ty = operandAsNumber(op.operands[1]);
        state.moveText(tx, ty);
        // Significant vertical move indicates a new line
        if (Math.abs(ty) > 0.5 && lineHasContent) {
          parts.push('\n');
          lineHasContent = false;
        } else if (Math.abs(tx) > state.fontSize * 0.3 && lineHasContent) {
          // Horizontal gap — insert a space
          parts.push(' ');
        }
        break;
      }

      case 'TD': {
        const tx = operandAsNumber(op.operands[0]);
        const ty = operandAsNumber(op.operands[1]);
        state.leading = -ty;
        state.moveText(tx, ty);
        if (Math.abs(ty) > 0.5 && lineHasContent) {
          parts.push('\n');
          lineHasContent = false;
        }
        break;
      }

      case 'Tm':
        state.setTextMatrix(
          operandAsNumber(op.operands[0]),
          operandAsNumber(op.operands[1]),
          operandAsNumber(op.operands[2]),
          operandAsNumber(op.operands[3]),
          operandAsNumber(op.operands[4]),
          operandAsNumber(op.operands[5]),
        );
        break;

      case 'T*':
        state.nextLine();
        if (lineHasContent) {
          parts.push('\n');
          lineHasContent = false;
        }
        break;

      case 'Tj': {
        const text = state.decodeString(op.operands[0]);
        if (text.length > 0) {
          parts.push(text);
          lineHasContent = true;
        }
        break;
      }

      case 'TJ': {
        const text = state.decodeTJArray(op.operands[0]);
        if (text.length > 0) {
          parts.push(text);
          lineHasContent = true;
        }
        break;
      }

      case "'": {
        // Move to next line, then show string
        state.nextLine();
        if (lineHasContent) {
          parts.push('\n');
          lineHasContent = false;
        }
        const text = state.decodeString(op.operands[0]);
        if (text.length > 0) {
          parts.push(text);
          lineHasContent = true;
        }
        break;
      }

      case '"': {
        // Set word/char spacing, move to next line, show string
        state.wordSpacing = operandAsNumber(op.operands[0]);
        state.charSpacing = operandAsNumber(op.operands[1]);
        state.nextLine();
        if (lineHasContent) {
          parts.push('\n');
          lineHasContent = false;
        }
        const text = state.decodeString(op.operands[2]);
        if (text.length > 0) {
          parts.push(text);
          lineHasContent = true;
        }
        break;
      }

      case 'q':
        state.save();
        break;

      case 'Q':
        state.restore();
        break;

      case 'cm':
        state.concatCTM(
          operandAsNumber(op.operands[0]),
          operandAsNumber(op.operands[1]),
          operandAsNumber(op.operands[2]),
          operandAsNumber(op.operands[3]),
          operandAsNumber(op.operands[4]),
          operandAsNumber(op.operands[5]),
        );
        break;

      // Other operators are ignored for text extraction
      default:
        break;
    }
  }

  return parts.join('');
}

/**
 * Extract text with position information from a parsed content stream.
 *
 * Each returned {@link TextItem} includes the text string, its position
 * (x, y), dimensions (width, height), font size, and font name.
 *
 * @param operators - Parsed content-stream operators.
 * @param resources - Optional page `/Resources` dictionary.
 * @returns An array of positioned text items.
 */
export function extractTextWithPositions(
  operators: ContentStreamOperator[],
  resources?: PdfDict,
): TextItem[] {
  const state = new TextState(resources);
  const items: TextItem[] = [];

  for (const op of operators) {
    switch (op.operator) {
      case 'BT':
        state.resetTextMatrix();
        break;

      case 'ET':
        break;

      case 'Tf':
        state.setFont(
          operandAsString(op.operands[0]),
          operandAsNumber(op.operands[1]),
        );
        break;

      case 'Tc':
        state.charSpacing = operandAsNumber(op.operands[0]);
        break;

      case 'Tw':
        state.wordSpacing = operandAsNumber(op.operands[0]);
        break;

      case 'TL':
        state.leading = operandAsNumber(op.operands[0]);
        break;

      case 'Tz':
        state.horizontalScaling = operandAsNumber(op.operands[0]);
        break;

      case 'Ts':
        state.rise = operandAsNumber(op.operands[0]);
        break;

      case 'Td':
        state.moveText(
          operandAsNumber(op.operands[0]),
          operandAsNumber(op.operands[1]),
        );
        break;

      case 'TD': {
        const tx = operandAsNumber(op.operands[0]);
        const ty = operandAsNumber(op.operands[1]);
        state.leading = -ty;
        state.moveText(tx, ty);
        break;
      }

      case 'Tm':
        state.setTextMatrix(
          operandAsNumber(op.operands[0]),
          operandAsNumber(op.operands[1]),
          operandAsNumber(op.operands[2]),
          operandAsNumber(op.operands[3]),
          operandAsNumber(op.operands[4]),
          operandAsNumber(op.operands[5]),
        );
        break;

      case 'T*':
        state.nextLine();
        break;

      case 'Tj': {
        const text = state.decodeString(op.operands[0]);
        if (text.length > 0) {
          const pos = state.getTextPosition();
          items.push({
            text,
            x: pos.x,
            y: pos.y,
            width: state.estimateWidth(text),
            height: state.fontSize,
            fontSize: state.fontSize,
            fontName: state.fontName,
          });
          // Advance text position by estimated width
          state.advanceByText(text);
        }
        break;
      }

      case 'TJ': {
        const operand = op.operands[0];
        if (Array.isArray(operand)) {
          for (const elem of operand) {
            if (typeof elem === 'number') {
              // Negative = move right, positive = move left
              // Expressed in thousandths of a unit of text space
              state.advanceByDisplacement(-elem);
            } else {
              const text = state.decodeString(elem);
              if (text.length > 0) {
                const pos = state.getTextPosition();
                items.push({
                  text,
                  x: pos.x,
                  y: pos.y,
                  width: state.estimateWidth(text),
                  height: state.fontSize,
                  fontSize: state.fontSize,
                  fontName: state.fontName,
                });
                state.advanceByText(text);
              }
            }
          }
        }
        break;
      }

      case "'":
        state.nextLine();
        {
          const text = state.decodeString(op.operands[0]);
          if (text.length > 0) {
            const pos = state.getTextPosition();
            items.push({
              text,
              x: pos.x,
              y: pos.y,
              width: state.estimateWidth(text),
              height: state.fontSize,
              fontSize: state.fontSize,
              fontName: state.fontName,
            });
            state.advanceByText(text);
          }
        }
        break;

      case '"':
        state.wordSpacing = operandAsNumber(op.operands[0]);
        state.charSpacing = operandAsNumber(op.operands[1]);
        state.nextLine();
        {
          const text = state.decodeString(op.operands[2]);
          if (text.length > 0) {
            const pos = state.getTextPosition();
            items.push({
              text,
              x: pos.x,
              y: pos.y,
              width: state.estimateWidth(text),
              height: state.fontSize,
              fontSize: state.fontSize,
              fontName: state.fontName,
            });
            state.advanceByText(text);
          }
        }
        break;

      case 'q':
        state.save();
        break;

      case 'Q':
        state.restore();
        break;

      case 'cm':
        state.concatCTM(
          operandAsNumber(op.operands[0]),
          operandAsNumber(op.operands[1]),
          operandAsNumber(op.operands[2]),
          operandAsNumber(op.operands[3]),
          operandAsNumber(op.operands[4]),
          operandAsNumber(op.operands[5]),
        );
        break;

      default:
        break;
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// ToUnicode CMap parser
// ---------------------------------------------------------------------------

/**
 * A parsed ToUnicode CMap that maps character codes to Unicode strings.
 */
export interface ToUnicodeCMap {
  /** Map from character code to Unicode string. */
  readonly map: ReadonlyMap<number, string>;
}

/**
 * Parse a ToUnicode CMap stream into a lookup map.
 *
 * Handles the two standard mapping constructs:
 * - `beginbfchar` / `endbfchar` — single code-to-Unicode mappings
 * - `beginbfrange` / `endbfrange` — range-based mappings
 *
 * @param data - The raw CMap stream bytes (already decompressed).
 * @returns A parsed CMap.
 */
export function parseToUnicodeCMap(data: Uint8Array): ToUnicodeCMap {
  const text = decodeText(data);
  const map = new Map<number, string>();

  // Parse beginbfchar / endbfchar sections
  parseBfCharSections(text, map);

  // Parse beginbfrange / endbfrange sections
  parseBfRangeSections(text, map);

  return { map };
}

/**
 * Parse all `beginbfchar`/`endbfchar` sections in a CMap.
 */
function parseBfCharSections(text: string, map: Map<number, string>): void {
  const regex = /beginbfchar\s*([\s\S]*?)\s*endbfchar/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const body = match[1]!;
    // Each line: <srcCode> <dstString>
    const lineRegex = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let lineMatch: RegExpExecArray | null;

    while ((lineMatch = lineRegex.exec(body)) !== null) {
      const srcCode = parseInt(lineMatch[1]!, 16);
      const dstString = hexToUnicode(lineMatch[2]!);
      map.set(srcCode, dstString);
    }
  }
}

/**
 * Parse all `beginbfrange`/`endbfrange` sections in a CMap.
 */
function parseBfRangeSections(text: string, map: Map<number, string>): void {
  const regex = /beginbfrange\s*([\s\S]*?)\s*endbfrange/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const body = match[1]!;

    // Two forms:
    // 1. <srcLow> <srcHigh> <dstStart>
    // 2. <srcLow> <srcHigh> [<dst1> <dst2> ...]
    const lineRegex =
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g;
    let lineMatch: RegExpExecArray | null;

    while ((lineMatch = lineRegex.exec(body)) !== null) {
      const srcLow = parseInt(lineMatch[1]!, 16);
      const srcHigh = parseInt(lineMatch[2]!, 16);

      if (lineMatch[3]) {
        // Form 1: sequential mapping starting at dstStart
        let dstCode = parseInt(lineMatch[3], 16);
        for (let code = srcLow; code <= srcHigh; code++) {
          map.set(code, codePointToString(dstCode));
          dstCode++;
        }
      } else if (lineMatch[4]) {
        // Form 2: array of destination strings
        const arrRegex = /<([0-9a-fA-F]+)>/g;
        let arrMatch: RegExpExecArray | null;
        let code = srcLow;

        while ((arrMatch = arrRegex.exec(lineMatch[4])) !== null && code <= srcHigh) {
          map.set(code, hexToUnicode(arrMatch[1]!));
          code++;
        }
      }
    }
  }
}

/**
 * Convert a hex string (2 or 4 hex chars per code point) to a Unicode
 * string.
 */
function hexToUnicode(hex: string): string {
  const parts: string[] = [];
  // Process 4 hex chars (2 bytes) at a time for BMP characters
  // If the hex string is shorter, pad or process accordingly
  const step = hex.length <= 4 ? hex.length : 4;
  for (let i = 0; i < hex.length; i += step) {
    const chunk = hex.slice(i, i + step);
    const code = parseInt(chunk, 16);
    if (!Number.isNaN(code)) {
      parts.push(String.fromCodePoint(code));
    }
  }
  return parts.join('');
}

/**
 * Convert a numeric code point to a string.
 */
function codePointToString(code: number): string {
  return String.fromCodePoint(code);
}

// ---------------------------------------------------------------------------
// WinAnsiEncoding
// ---------------------------------------------------------------------------

/**
 * WinAnsiEncoding table for bytes 0x80-0x9F that differ from Latin-1.
 * Bytes 0x00-0x7F and 0xA0-0xFF map directly to their Unicode code points.
 */
const WIN_ANSI_SPECIAL: Record<number, number> = {
  0x80: 0x20ac, // Euro sign
  0x82: 0x201a, // Single low-9 quotation mark
  0x83: 0x0192, // Latin small letter f with hook
  0x84: 0x201e, // Double low-9 quotation mark
  0x85: 0x2026, // Horizontal ellipsis
  0x86: 0x2020, // Dagger
  0x87: 0x2021, // Double dagger
  0x88: 0x02c6, // Modifier letter circumflex accent
  0x89: 0x2030, // Per mille sign
  0x8a: 0x0160, // Latin capital letter S with caron
  0x8b: 0x2039, // Single left-pointing angle quotation mark
  0x8c: 0x0152, // Latin capital ligature OE
  0x8e: 0x017d, // Latin capital letter Z with caron
  0x91: 0x2018, // Left single quotation mark
  0x92: 0x2019, // Right single quotation mark
  0x93: 0x201c, // Left double quotation mark
  0x94: 0x201d, // Right double quotation mark
  0x95: 0x2022, // Bullet
  0x96: 0x2013, // En dash
  0x97: 0x2014, // Em dash
  0x98: 0x02dc, // Small tilde
  0x99: 0x2122, // Trade mark sign
  0x9a: 0x0161, // Latin small letter s with caron
  0x9b: 0x203a, // Single right-pointing angle quotation mark
  0x9c: 0x0153, // Latin small ligature oe
  0x9e: 0x017e, // Latin small letter z with caron
  0x9f: 0x0178, // Latin capital letter Y with diaeresis
};

/**
 * Decode a single byte using WinAnsiEncoding.
 */
function winAnsiDecode(byte: number): string {
  if (Object.hasOwn(WIN_ANSI_SPECIAL, byte)) {
    return String.fromCodePoint(WIN_ANSI_SPECIAL[byte]!);
  }
  return String.fromCharCode(byte);
}

// ---------------------------------------------------------------------------
// Text state tracking
// ---------------------------------------------------------------------------

/**
 * A 3x3 transformation matrix stored as 6 values `[a, b, c, d, e, f]`:
 *
 * ```
 * [ a  b  0 ]
 * [ c  d  0 ]
 * [ e  f  1 ]
 * ```
 */
type Matrix = [number, number, number, number, number, number];

/** Identity matrix. */
function identityMatrix(): Matrix {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Multiply two 3x3 matrices (stored as 6-element arrays).
 * Result = A * B
 */
function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/**
 * Saved graphics state snapshot.
 */
interface SavedState {
  ctm: Matrix;
  fontName: string;
  fontSize: number;
  charSpacing: number;
  wordSpacing: number;
  horizontalScaling: number;
  leading: number;
  rise: number;
}

/**
 * Tracks the graphics/text state needed for text extraction.
 */
class TextState {
  /** Current transformation matrix (CTM). */
  private ctm: Matrix = identityMatrix();

  /** Text matrix — set by Tm, updated by Td/TD/T*. */
  private textMatrix: Matrix = identityMatrix();

  /** Text line matrix — the matrix at the start of the current line. */
  private textLineMatrix: Matrix = identityMatrix();

  /** Current font resource name. */
  fontName: string = '';

  /** Current font size. */
  fontSize: number = 12;

  /** Character spacing (Tc). */
  charSpacing: number = 0;

  /** Word spacing (Tw). */
  wordSpacing: number = 0;

  /** Horizontal scaling (Tz) as a percentage (100 = normal). */
  horizontalScaling: number = 100;

  /** Text leading (TL). */
  leading: number = 0;

  /** Text rise (Ts). */
  rise: number = 0;

  /** Graphics state stack for q/Q. */
  private stateStack: SavedState[] = [];

  /** Page resources dictionary. */
  private readonly resources: PdfDict | undefined;

  /** Cache of parsed ToUnicode CMaps per font name. */
  private readonly cmapCache = new Map<string, ToUnicodeCMap | null>();

  /** Cache of font encoding type per font name. */
  private readonly fontEncodingCache = new Map<string, string>();

  /** Cache of whether a font is a CID (2-byte) font. */
  private readonly cidFontCache = new Map<string, boolean>();

  constructor(resources?: PdfDict) {
    this.resources = resources;
    if (resources) {
      this.analyzeFonts(resources);
    }
  }

  // -----------------------------------------------------------------------
  // Font analysis
  // -----------------------------------------------------------------------

  /**
   * Pre-analyze fonts from the resources dictionary to determine encoding
   * types and cache ToUnicode CMaps.
   */
  private analyzeFonts(resources: PdfDict): void {
    const fonts = resources.get('/Font');
    if (!(fonts instanceof PdfDict)) return;

    for (const [name, fontObj] of fonts) {
      if (!(fontObj instanceof PdfDict)) continue;

      // Check if it is a CID font (Type0)
      const subtype = fontObj.get('/Subtype');
      const isCid =
        subtype instanceof PdfName &&
        (subtype.value === '/Type0' || subtype.value === '/CIDFontType0' || subtype.value === '/CIDFontType2');
      this.cidFontCache.set(name, isCid);

      // Check encoding
      const encoding = fontObj.get('/Encoding');
      if (encoding instanceof PdfName) {
        this.fontEncodingCache.set(name, encoding.value.replace(/^\//, ''));
      }

      // Parse ToUnicode CMap if available
      const toUnicode = fontObj.get('/ToUnicode');
      if (toUnicode instanceof PdfStream) {
        try {
          const cmap = parseToUnicodeCMap(toUnicode.data);
          this.cmapCache.set(name, cmap);
        } catch {
          this.cmapCache.set(name, null);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // State management
  // -----------------------------------------------------------------------

  /**
   * Save the current graphics state (q).
   */
  save(): void {
    this.stateStack.push({
      ctm: [...this.ctm] as Matrix,
      fontName: this.fontName,
      fontSize: this.fontSize,
      charSpacing: this.charSpacing,
      wordSpacing: this.wordSpacing,
      horizontalScaling: this.horizontalScaling,
      leading: this.leading,
      rise: this.rise,
    });
  }

  /**
   * Restore the previously saved graphics state (Q).
   */
  restore(): void {
    const saved = this.stateStack.pop();
    if (saved) {
      this.ctm = saved.ctm;
      this.fontName = saved.fontName;
      this.fontSize = saved.fontSize;
      this.charSpacing = saved.charSpacing;
      this.wordSpacing = saved.wordSpacing;
      this.horizontalScaling = saved.horizontalScaling;
      this.leading = saved.leading;
      this.rise = saved.rise;
    }
  }

  /**
   * Concatenate a matrix with the CTM (cm).
   */
  concatCTM(a: number, b: number, c: number, d: number, e: number, f: number): void {
    const m: Matrix = [a, b, c, d, e, f];
    this.ctm = multiplyMatrices(m, this.ctm);
  }

  /**
   * Reset the text matrix to identity (called at BT).
   */
  resetTextMatrix(): void {
    this.textMatrix = identityMatrix();
    this.textLineMatrix = identityMatrix();
  }

  /**
   * Set the font and size (Tf).
   */
  setFont(name: string, size: number): void {
    // Normalize font name to include leading /
    this.fontName = name.startsWith('/') ? name : `/${name}`;
    this.fontSize = size;
  }

  /**
   * Move text position (Td).
   */
  moveText(tx: number, ty: number): void {
    const translation: Matrix = [1, 0, 0, 1, tx, ty];
    this.textLineMatrix = multiplyMatrices(translation, this.textLineMatrix);
    this.textMatrix = [...this.textLineMatrix] as Matrix;
  }

  /**
   * Set the text matrix directly (Tm).
   */
  setTextMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.textMatrix = [a, b, c, d, e, f];
    this.textLineMatrix = [a, b, c, d, e, f];
  }

  /**
   * Move to the start of the next line (T*).
   * Equivalent to: 0 -TL Td
   */
  nextLine(): void {
    this.moveText(0, -this.leading);
  }

  // -----------------------------------------------------------------------
  // Position computation
  // -----------------------------------------------------------------------

  /**
   * Get the current text position in user-space coordinates.
   */
  getTextPosition(): { x: number; y: number } {
    // The effective position is the text matrix applied to (0, 0), then
    // transformed by the CTM.
    const combined = multiplyMatrices(this.textMatrix, this.ctm);
    return { x: combined[4], y: combined[5] };
  }

  /**
   * Estimate the width of a text string in user-space units.
   *
   * Uses a rough heuristic: 0.5 * fontSize per character for standard
   * fonts.  A production implementation would use font metrics.
   */
  estimateWidth(text: string): number {
    const avgCharWidth = 0.5; // Approximate proportion of fontSize
    const hScale = this.horizontalScaling / 100;
    return text.length * this.fontSize * avgCharWidth * hScale;
  }

  /**
   * Advance the text matrix by the width of the given text.
   */
  advanceByText(text: string): void {
    const width = this.estimateWidth(text);
    const tx: Matrix = [1, 0, 0, 1, width, 0];
    this.textMatrix = multiplyMatrices(tx, this.textMatrix);
  }

  /**
   * Advance the text matrix by a TJ displacement value.
   *
   * The displacement is in thousandths of a unit of text space.
   */
  advanceByDisplacement(displacement: number): void {
    const tx = (displacement / 1000) * this.fontSize * (this.horizontalScaling / 100);
    const m: Matrix = [1, 0, 0, 1, tx, 0];
    this.textMatrix = multiplyMatrices(m, this.textMatrix);
  }

  // -----------------------------------------------------------------------
  // String decoding
  // -----------------------------------------------------------------------

  /**
   * Decode an operand (string or hex string) into a readable text string.
   *
   * Uses the current font's ToUnicode CMap if available, otherwise falls
   * back to WinAnsiEncoding or direct code-point mapping.
   */
  decodeString(operand: Operand | undefined): string {
    if (operand == null) return '';
    if (typeof operand === 'number') return '';

    const raw = typeof operand === 'string' ? operand : String(operand);

    // Look up the font's ToUnicode CMap
    const cmap = this.cmapCache.get(this.fontName);
    const isCid = this.cidFontCache.get(this.fontName) ?? false;

    if (cmap) {
      return this.decodeWithCMap(raw, cmap, isCid);
    }

    if (isCid) {
      // CID font without ToUnicode — try 2-byte Identity-H decoding
      return this.decodeCIDString(raw);
    }

    // Standard encoding (WinAnsiEncoding or similar)
    return this.decodeWinAnsi(raw);
  }

  /**
   * Decode a TJ array operand (array of strings + numbers).
   */
  decodeTJArray(operand: Operand | undefined): string {
    if (!Array.isArray(operand)) {
      return this.decodeString(operand);
    }

    const parts: string[] = [];
    for (const elem of operand) {
      if (typeof elem === 'number') {
        // Large negative displacement indicates a word space
        if (elem <= -100) {
          parts.push(' ');
        }
        // Positive or small negative displacements are kerning — ignore
      } else {
        const decoded = this.decodeString(elem);
        if (decoded.length > 0) {
          parts.push(decoded);
        }
      }
    }
    return parts.join('');
  }

  /**
   * Decode a string using a ToUnicode CMap.
   */
  private decodeWithCMap(raw: string, cmap: ToUnicodeCMap, isCid: boolean): string {
    let result = '';

    if (isCid) {
      // 2 bytes per character code
      for (let i = 0; i + 1 < raw.length; i += 2) {
        const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
        const mapped = cmap.map.get(code);
        if (mapped !== undefined) {
          result += mapped;
        } else {
          // Fallback: use the code directly if it is a valid Unicode point
          if (code >= 0x20 && code <= 0xffff) {
            result += String.fromCharCode(code);
          }
        }
      }
    } else {
      // 1 byte per character code
      for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        const mapped = cmap.map.get(code);
        if (mapped !== undefined) {
          result += mapped;
        } else {
          result += winAnsiDecode(code);
        }
      }
    }

    return result;
  }

  /**
   * Decode a CID (Identity-H) encoded string without a ToUnicode CMap.
   */
  private decodeCIDString(raw: string): string {
    let result = '';
    for (let i = 0; i + 1 < raw.length; i += 2) {
      const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
      if (code >= 0x20 && code <= 0xffff) {
        result += String.fromCharCode(code);
      }
    }
    return result;
  }

  /**
   * Decode a string using WinAnsiEncoding.
   */
  private decodeWinAnsi(raw: string): string {
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      result += winAnsiDecode(code);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Operand extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract a numeric value from an operand, defaulting to 0.
 */
function operandAsNumber(operand: Operand | undefined): number {
  if (typeof operand === 'number') return operand;
  if (operand instanceof PdfNumber) return operand.value;
  if (typeof operand === 'string') {
    const n = parseFloat(operand);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Extract a string value from an operand.
 */
function operandAsString(operand: Operand | undefined): string {
  if (typeof operand === 'string') return operand;
  if (operand instanceof PdfName) return operand.value;
  if (typeof operand === 'number') return String(operand);
  return '';
}

// ---------------------------------------------------------------------------
// Text decoding utility
// ---------------------------------------------------------------------------

/**
 * Decode raw bytes to a string (ASCII/Latin-1 — sufficient for CMap
 * parsing which is ASCII-based).
 */
function decodeText(data: Uint8Array): string {
  return new TextDecoder('latin1').decode(data);
}
