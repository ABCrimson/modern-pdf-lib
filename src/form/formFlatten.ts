/**
 * @module form/formFlatten
 *
 * Flatten interactive form fields into static page content.
 *
 * Form flattening converts interactive AcroForm fields into non-editable
 * page content by merging each field's appearance stream into the page's
 * content stream as a Form XObject, then removing the interactive form
 * structure (widget annotations and the AcroForm dictionary).
 *
 * This is a common enterprise requirement for producing final,
 * non-editable PDFs (e.g. invoices, contracts, government forms).
 *
 * Reference: PDF 1.7 spec, SS12.5.5 (Appearance Streams),
 *            SS12.7 (Interactive Forms).
 */

import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfString,
  PdfArray,
  PdfStream,
} from '../core/pdfObjects.js';
import type { PdfField } from './pdfField.js';
import { FieldFlags, numVal, strVal } from './pdfField.js';
import type { PdfForm } from './pdfForm.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for form flattening operations.
 */
export interface FlattenOptions {
  /**
   * If `true`, read-only fields are skipped and left interactive.
   * All other fields are flattened normally.
   *
   * Default: `false` (all fields are flattened, including read-only ones).
   */
  preserveReadOnly?: boolean | undefined;

  /**
   * If `true`, use /RV rich text value when available instead of /V.
   * Rich text (/RV) is an XHTML string containing formatting such as
   * bold, italic, font-size, color, and font-family. When enabled,
   * the flattener parses the XHTML and generates an appearance stream
   * that preserves the rich text styling. If parsing fails, the
   * flattener falls back to the plain text /V value.
   *
   * Default: `true`.
   */
  preserveRichText?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Format a number for PDF content stream output. */
function n(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  const s = value.toFixed(6).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Get the normal (/N) appearance stream from a field's widget dictionary.
 *
 * Checks the /AP dictionary for a /N entry that is a PdfStream.
 * If /AP is absent or /N is not a stream, returns `undefined`.
 */
function getAppearanceStream(widgetDict: PdfDict): PdfStream | undefined {
  const ap = widgetDict.get('/AP');
  if (ap === undefined || ap.kind !== 'dict') return undefined;

  const apDict = ap as PdfDict;
  const nObj = apDict.get('/N');

  // /N can be a stream directly (most fields) or a dict of streams
  // (checkboxes/radio buttons — keyed by state name).
  if (nObj === undefined) return undefined;

  if (nObj.kind === 'stream') {
    return nObj as PdfStream;
  }

  // For checkbox/radio: /N is a dict mapping state names to streams.
  // Pick the stream matching the current /AS (appearance state).
  if (nObj.kind === 'dict') {
    const nDict = nObj as PdfDict;
    const asObj = widgetDict.get('/AS');
    if (asObj !== undefined && asObj.kind === 'name') {
      const stateName = (asObj as PdfName).value;
      const stateStream = nDict.get(stateName);
      if (stateStream !== undefined && stateStream.kind === 'stream') {
        return stateStream as PdfStream;
      }
    }
    // Fallback: try to find any non-Off stream
    for (const [key, value] of nDict) {
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      if (cleanKey !== 'Off' && value.kind === 'stream') {
        return value as PdfStream;
      }
    }
  }

  return undefined;
}

/**
 * Extract the widget rectangle as `[x1, y1, x2, y2]`.
 */
function getWidgetRect(widgetDict: PdfDict): [number, number, number, number] {
  const rectObj = widgetDict.get('/Rect');
  if (rectObj !== undefined && rectObj.kind === 'array') {
    const arr = rectObj as PdfArray;
    const x1 = numVal(arr.items[0]) ?? 0;
    const y1 = numVal(arr.items[1]) ?? 0;
    const x2 = numVal(arr.items[2]) ?? 0;
    const y2 = numVal(arr.items[3]) ?? 0;
    return [x1, y1, x2, y2];
  }
  return [0, 0, 0, 0];
}

/**
 * Build the content stream operators that paint a Form XObject
 * at the position and size defined by the widget rectangle.
 *
 * Uses the XObject's BBox to determine scaling. If no BBox is found,
 * the widget dimensions are used as a 1:1 mapping.
 */
function buildFlattenOps(
  xObjectName: string,
  rect: [number, number, number, number],
  appearance: PdfStream,
): string {
  const [x1, y1, x2, y2] = rect;
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  if (width <= 0 || height <= 0) return '';

  // Determine the appearance stream's native size from BBox
  let bboxWidth = width;
  let bboxHeight = height;

  const bboxObj = appearance.dict.get('/BBox');
  if (bboxObj !== undefined && bboxObj.kind === 'array') {
    const bboxArr = bboxObj as PdfArray;
    const bx1 = numVal(bboxArr.items[0]) ?? 0;
    const by1 = numVal(bboxArr.items[1]) ?? 0;
    const bx2 = numVal(bboxArr.items[2]) ?? width;
    const by2 = numVal(bboxArr.items[3]) ?? height;
    bboxWidth = Math.abs(bx2 - bx1);
    bboxHeight = Math.abs(by2 - by1);
  }

  // Scale factors to map the XObject's coordinate space to the widget rect
  const sx = bboxWidth > 0 ? width / bboxWidth : 1;
  const sy = bboxHeight > 0 ? height / bboxHeight : 1;

  let ops = '';
  ops += 'q\n';
  // Position at the widget's lower-left corner, scaled to widget size
  ops += `${n(sx)} 0 0 ${n(sy)} ${n(Math.min(x1, x2))} ${n(Math.min(y1, y2))} cm\n`;
  ops += `/${xObjectName} Do\n`;
  ops += 'Q\n';

  return ops;
}

/**
 * Check whether a field should be skipped based on flatten options.
 */
function shouldSkipField(field: PdfField, options: FlattenOptions): boolean {
  if (options.preserveReadOnly && field.isReadOnly()) {
    return true;
  }
  return false;
}

/**
 * Result of flattening a single field, containing the operators and
 * XObject entries to merge into the page.
 */
interface FlattenResult {
  /** Content stream operators to append to the page. */
  ops: string;
  /** XObject name-to-stream pairs to add to page resources. */
  xObjects: Array<{ name: string; stream: PdfStream }>;
}

/** Monotonically increasing counter for unique XObject names. */
let flattenXObjectCounter = 0;

/**
 * Reset the XObject name counter (for testing determinism).
 * @internal
 */
export function _resetFlattenCounter(): void {
  flattenXObjectCounter = 0;
}

// ---------------------------------------------------------------------------
// Rich text (XHTML /RV) parsing and appearance generation
// ---------------------------------------------------------------------------

/**
 * Standard 14 PDF font name mapping.
 *
 * Maps common CSS font-family names (lower-cased) to their PDF
 * standard 14 resource names. When a rich text XHTML references a
 * font-family, we try this map first before falling back to the
 * default Helvetica.
 */
const CSS_TO_PDF_FONT: ReadonlyMap<string, string> = new Map([
  ['helvetica', 'Helv'],
  ['arial', 'Helv'],
  ['sans-serif', 'Helv'],
  ['times', 'TiRo'],
  ['times new roman', 'TiRo'],
  ['times-roman', 'TiRo'],
  ['serif', 'TiRo'],
  ['courier', 'Cour'],
  ['courier new', 'Cour'],
  ['monospace', 'Cour'],
]);

/** Base font name for each short name. */
const PDF_FONT_BASE: ReadonlyMap<string, string> = new Map([
  ['Helv', 'Helvetica'],
  ['TiRo', 'Times-Roman'],
  ['Cour', 'Courier'],
  ['HeBo', 'Helvetica-Bold'],
  ['HeIt', 'Helvetica-Oblique'],
  ['HeBI', 'Helvetica-BoldOblique'],
  ['TiBo', 'Times-Bold'],
  ['TiIt', 'Times-Italic'],
  ['TiBI', 'Times-BoldItalic'],
  ['CoBo', 'Courier-Bold'],
  ['CoIt', 'Courier-Oblique'],
  ['CoBI', 'Courier-BoldOblique'],
]);

/**
 * A single span of text with uniform styling, extracted from XHTML.
 */
interface RichTextSpan {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  /** CSS color string (e.g. "rgb(255,0,0)", "#ff0000", "red"). */
  color: string;
  /** Resolved PDF short font name (e.g. "Helv"). */
  fontName: string;
}

/**
 * A paragraph of rich text spans, with optional text alignment.
 */
interface RichTextParagraph {
  spans: RichTextSpan[];
  alignment: number; // 0=left, 1=center, 2=right
}

/**
 * Result of parsing an XHTML /RV value.
 */
interface RichTextParseResult {
  paragraphs: RichTextParagraph[];
}

/** Escape a string for use in a PDF literal string. */
function escapePdf(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n');
}

/**
 * Parse a CSS color value and return PDF color operators.
 *
 * Supports: `rgb(r,g,b)`, `#rrggbb`, `#rgb`, and named colors
 * (black, red, blue, green, white).
 *
 * Returns a string like `"1 0 0 rg"` (fill color) or `"0 g"` for grayscale.
 */
function cssColorToPdfOps(color: string): string {
  const trimmed = color.trim().toLowerCase();

  // Named colors
  const named: Record<string, [number, number, number]> = {
    black: [0, 0, 0],
    white: [1, 1, 1],
    red: [1, 0, 0],
    green: [0, 0.5, 0],
    blue: [0, 0, 1],
    gray: [0.5, 0.5, 0.5],
    grey: [0.5, 0.5, 0.5],
  };
  if (trimmed in named) {
    const [r, g, b] = named[trimmed]!;
    if (r === g && g === b) return `${n(r)} g`;
    return `${n(r)} ${n(g)} ${n(b)} rg`;
  }

  // rgb(r, g, b) or rgb(r,g,b)
  const rgbMatch = trimmed.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10) / 255;
    const g = parseInt(rgbMatch[2]!, 10) / 255;
    const b = parseInt(rgbMatch[3]!, 10) / 255;
    if (r === g && g === b) return `${n(r)} g`;
    return `${n(r)} ${n(g)} ${n(b)} rg`;
  }

  // #rrggbb
  const hex6Match = trimmed.match(/^#([0-9a-f]{6})$/);
  if (hex6Match) {
    const hex = hex6Match[1]!;
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    if (r === g && g === b) return `${n(r)} g`;
    return `${n(r)} ${n(g)} ${n(b)} rg`;
  }

  // #rgb
  const hex3Match = trimmed.match(/^#([0-9a-f]{3})$/);
  if (hex3Match) {
    const hex = hex3Match[1]!;
    const r = parseInt(hex[0]! + hex[0]!, 16) / 255;
    const g = parseInt(hex[1]! + hex[1]!, 16) / 255;
    const b = parseInt(hex[2]! + hex[2]!, 16) / 255;
    if (r === g && g === b) return `${n(r)} g`;
    return `${n(r)} ${n(g)} ${n(b)} rg`;
  }

  // Default: black
  return '0 g';
}

/**
 * Resolve a CSS font-family string to a PDF font short name.
 */
function cssFontFamilyToPdf(family: string): string {
  // Strip quotes and take the first family in the list
  const first = family.split(',')[0]!.trim().replaceAll('"', '').replaceAll("'", '').toLowerCase();
  return CSS_TO_PDF_FONT.get(first) ?? 'Helv';
}

/**
 * Get the styled variant of a base PDF font.
 *
 * For example, Helv + bold + italic = HeBI.
 */
function getStyledFontName(baseName: string, bold: boolean, italic: boolean): string {
  if (!bold && !italic) return baseName;

  // Map base short names to their styled variants
  const variants: Record<string, { bold: string; italic: string; boldItalic: string }> = {
    Helv: { bold: 'HeBo', italic: 'HeIt', boldItalic: 'HeBI' },
    TiRo: { bold: 'TiBo', italic: 'TiIt', boldItalic: 'TiBI' },
    Cour: { bold: 'CoBo', italic: 'CoIt', boldItalic: 'CoBI' },
  };

  const entry = variants[baseName];
  if (entry === undefined) return baseName;

  if (bold && italic) return entry.boldItalic;
  if (bold) return entry.bold;
  return entry.italic;
}

/**
 * Parse inline CSS style attributes and extract relevant properties.
 */
function parseStyleAttribute(style: string): {
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
} {
  const result: ReturnType<typeof parseStyleAttribute> = {};

  for (const declaration of style.split(';')) {
    const colonIdx = declaration.indexOf(':');
    if (colonIdx < 0) continue;
    const prop = declaration.slice(0, colonIdx).trim().toLowerCase();
    const value = declaration.slice(colonIdx + 1).trim();

    switch (prop) {
      case 'font-size': {
        const sizeMatch = value.match(/([\d.]+)\s*(pt|px|em|rem)?/);
        if (sizeMatch) {
          let size = parseFloat(sizeMatch[1]!);
          const unit = sizeMatch[2] ?? 'pt';
          // Approximate conversions to points
          if (unit === 'px') size *= 0.75;
          else if (unit === 'em' || unit === 'rem') size *= 12;
          result.fontSize = size;
        }
        break;
      }
      case 'color':
        result.color = value;
        break;
      case 'font-family':
        result.fontFamily = value;
        break;
      case 'font-weight':
        result.fontWeight = value;
        break;
      case 'font-style':
        result.fontStyle = value;
        break;
      case 'text-align':
        result.textAlign = value;
        break;
    }
  }

  return result;
}

/**
 * Parse CSS text-align to PDF quadding value.
 */
function textAlignToQuadding(align: string | undefined): number {
  if (align === undefined) return 0;
  switch (align.toLowerCase()) {
    case 'center':
      return 1;
    case 'right':
      return 2;
    default:
      return 0;
  }
}

/**
 * Parse an XHTML /RV rich text string into structured paragraphs.
 *
 * Supports: `<b>`, `<i>`, `<span style="...">`, `<p>`, `<br/>`.
 * This is a lightweight regex-based parser — not a full XML parser —
 * suitable for the simple XHTML subset used in PDF /RV values.
 *
 * @throws If the input is empty or cannot be parsed at all.
 */
function parseRichTextXhtml(xhtml: string): RichTextParseResult {
  if (xhtml.trim().length === 0) {
    throw new Error('Empty rich text value');
  }

  const paragraphs: RichTextParagraph[] = [];

  // Strip XML declaration and <body>/<html> wrappers
  let cleaned = xhtml
    .replace(/<\?xml[^?]*\?>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .trim();

  // If no <p> tags, treat the entire content as one paragraph
  if (!/<p[\s>]/i.test(cleaned)) {
    cleaned = `<p>${cleaned}</p>`;
  }

  // Split into paragraphs
  const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(cleaned)) !== null) {
    const pAttrs = pMatch[1] ?? '';
    const pContent = pMatch[2] ?? '';

    // Parse paragraph-level style for alignment
    let alignment = 0;
    const pStyleMatch = pAttrs.match(/style\s*=\s*"([^"]*)"/i);
    if (pStyleMatch) {
      const pStyle = parseStyleAttribute(pStyleMatch[1]!);
      alignment = textAlignToQuadding(pStyle.textAlign);
    }

    const spans = parseInlineContent(pContent, {
      bold: false,
      italic: false,
      fontSize: 0,
      color: '',
      fontName: 'Helv',
    });

    if (spans.length > 0) {
      paragraphs.push({ spans, alignment });
    }
  }

  if (paragraphs.length === 0) {
    throw new Error('No parseable content in rich text value');
  }

  return { paragraphs };
}

/**
 * Inherited style context for recursive inline parsing.
 */
interface InlineStyleContext {
  bold: boolean;
  italic: boolean;
  fontSize: number;
  color: string;
  fontName: string;
}

/**
 * Parse inline XHTML content (inside a `<p>`) into text spans.
 *
 * Handles nested `<b>`, `<i>`, `<span style="...">`, and `<br/>`.
 */
function parseInlineContent(
  html: string,
  inherited: InlineStyleContext,
): RichTextSpan[] {
  const spans: RichTextSpan[] = [];

  // Tokenize: split on tags while keeping them
  const tokens = html.split(/(<[^>]+>)/g);

  // Stack of style contexts
  const styleStack: InlineStyleContext[] = [{ ...inherited }];

  const currentStyle = (): InlineStyleContext => styleStack.at(-1)!;

  for (const token of tokens) {
    if (token.length === 0) continue;

    // Self-closing <br/> or <br />
    if (/^<br\s*\/?>$/i.test(token)) {
      spans.push({
        text: '\n',
        ...currentStyle(),
      });
      continue;
    }

    // Opening tags
    const openMatch = token.match(/^<(b|i|span|strong|em)\b([^>]*)>$/i);
    if (openMatch) {
      const tag = openMatch[1]!.toLowerCase();
      const attrs = openMatch[2] ?? '';
      const parent = currentStyle();
      const ctx: InlineStyleContext = { ...parent };

      if (tag === 'b' || tag === 'strong') {
        ctx.bold = true;
      } else if (tag === 'i' || tag === 'em') {
        ctx.italic = true;
      }

      // Parse style attribute if present
      const styleMatch = attrs.match(/style\s*=\s*"([^"]*)"/i);
      if (styleMatch) {
        const style = parseStyleAttribute(styleMatch[1]!);
        if (style.fontSize !== undefined) ctx.fontSize = style.fontSize;
        if (style.color !== undefined) ctx.color = style.color;
        if (style.fontFamily !== undefined) ctx.fontName = cssFontFamilyToPdf(style.fontFamily);
        if (style.fontWeight === 'bold' || style.fontWeight === '700') ctx.bold = true;
        if (style.fontStyle === 'italic' || style.fontStyle === 'oblique') ctx.italic = true;
      }

      styleStack.push(ctx);
      continue;
    }

    // Closing tags
    const closeMatch = token.match(/^<\/(b|i|span|strong|em)>$/i);
    if (closeMatch) {
      if (styleStack.length > 1) {
        styleStack.pop();
      }
      continue;
    }

    // Skip any other tags
    if (token.startsWith('<')) continue;

    // Plain text — decode HTML entities
    const text = decodeHtmlEntities(token);
    if (text.length > 0) {
      const style = currentStyle();
      spans.push({
        text,
        bold: style.bold,
        italic: style.italic,
        fontSize: style.fontSize,
        color: style.color,
        fontName: style.fontName,
      });
    }
  }

  return spans;
}

/**
 * Decode basic HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ');
}

/**
 * Generate a PDF appearance stream from parsed rich text.
 *
 * Lays out text spans with their individual styling (font, size, color)
 * within the given rectangle, respecting paragraph alignment.
 */
function generateRichTextAppearance(
  parsed: RichTextParseResult,
  rect: [number, number, number, number],
  multiline: boolean,
  defaultFontSize: number,
): PdfStream {
  const width = rect[2] - rect[0];
  const height = rect[3] - rect[1];
  const padding = 2;

  // Collect all unique font names used
  const usedFonts = new Set<string>();

  let ops = '';
  ops += '/Tx BMC\n';
  ops += 'q\n';
  // Clipping rectangle
  ops += `${n(padding)} ${n(padding)} ${n(width - 2 * padding)} ${n(height - 2 * padding)} re\n`;
  ops += 'W\n';
  ops += 'n\n';

  // Determine effective default font size
  const effectiveDefault = defaultFontSize > 0 ? defaultFontSize : 10;

  if (multiline) {
    // Multiline: render paragraphs vertically
    let cursorY = height - padding;

    for (const para of parsed.paragraphs) {
      // Determine line height from the tallest span
      let maxFontSize = effectiveDefault;
      for (const span of para.spans) {
        const sz = span.fontSize > 0 ? span.fontSize : effectiveDefault;
        if (sz > maxFontSize) maxFontSize = sz;
      }
      const lineHeight = maxFontSize * 1.2;
      cursorY -= maxFontSize;

      if (cursorY < padding) break;

      // Calculate total text width for alignment
      const totalWidth = computeSpansTotalWidth(para.spans, effectiveDefault);
      const availableWidth = width - 2 * padding;
      let startX = padding;
      if (para.alignment === 1) {
        startX = padding + Math.max(0, (availableWidth - totalWidth) / 2);
      } else if (para.alignment === 2) {
        startX = padding + Math.max(0, availableWidth - totalWidth);
      }

      // Handle newlines within spans (from <br/>)
      const lines = splitSpansIntoLines(para.spans);

      for (const lineSpans of lines) {
        if (cursorY < padding) break;

        const lineTotalWidth = computeSpansTotalWidth(lineSpans, effectiveDefault);
        let lineStartX = padding;
        if (para.alignment === 1) {
          lineStartX = padding + Math.max(0, (availableWidth - lineTotalWidth) / 2);
        } else if (para.alignment === 2) {
          lineStartX = padding + Math.max(0, availableWidth - lineTotalWidth);
        }

        let cursorX = lineStartX;

        ops += 'BT\n';
        for (const span of lineSpans) {
          const sz = span.fontSize > 0 ? span.fontSize : effectiveDefault;
          const styledFont = getStyledFontName(span.fontName, span.bold, span.italic);
          usedFonts.add(styledFont);

          ops += `/${styledFont} ${n(sz)} Tf\n`;
          ops += span.color.length > 0 ? `${cssColorToPdfOps(span.color)}\n` : '0 g\n';
          ops += `${n(cursorX)} ${n(cursorY)} Td\n`;
          ops += `(${escapePdf(span.text)}) Tj\n`;

          cursorX += span.text.length * sz * 0.5;
          // Reset Td base point
          ops += `${n(-cursorX)} ${n(-cursorY)} Td\n`;
        }
        ops += 'ET\n';

        cursorY -= lineHeight;
      }
    }
  } else {
    // Single-line: render first paragraph only, ignoring newlines
    const para = parsed.paragraphs[0];
    if (para !== undefined) {
      const flatSpans = flattenSpansRemovingNewlines(para.spans);

      // Determine the max font size for vertical centering
      let maxFontSize = effectiveDefault;
      for (const span of flatSpans) {
        const sz = span.fontSize > 0 ? span.fontSize : effectiveDefault;
        if (sz > maxFontSize) maxFontSize = sz;
      }

      const ty = (height - maxFontSize) / 2;
      const totalWidth = computeSpansTotalWidth(flatSpans, effectiveDefault);
      const availableWidth = width - 2 * padding;
      let startX = padding;
      if (para.alignment === 1) {
        startX = padding + Math.max(0, (availableWidth - totalWidth) / 2);
      } else if (para.alignment === 2) {
        startX = padding + Math.max(0, availableWidth - totalWidth);
      }

      let cursorX = startX;

      ops += 'BT\n';
      for (const span of flatSpans) {
        const sz = span.fontSize > 0 ? span.fontSize : effectiveDefault;
        const styledFont = getStyledFontName(span.fontName, span.bold, span.italic);
        usedFonts.add(styledFont);

        ops += `/${styledFont} ${n(sz)} Tf\n`;
        ops += span.color.length > 0 ? `${cssColorToPdfOps(span.color)}\n` : '0 g\n';
        ops += `${n(cursorX)} ${n(ty)} Td\n`;
        ops += `(${escapePdf(span.text)}) Tj\n`;

        cursorX += span.text.length * sz * 0.5;
        // Reset Td base point
        ops += `${n(-cursorX)} ${n(-ty)} Td\n`;
      }
      ops += 'ET\n';
    }
  }

  ops += 'Q\n';
  ops += 'EMC\n';

  // Build stream with resources for all used fonts
  const streamDict = new PdfDict();
  streamDict.set('/Type', PdfName.of('XObject'));
  streamDict.set('/Subtype', PdfName.of('Form'));
  streamDict.set('/BBox', PdfArray.fromNumbers([0, 0, width, height]));

  const resources = new PdfDict();
  const fontDict = new PdfDict();
  for (const fontShortName of usedFonts) {
    const baseFont = PDF_FONT_BASE.get(fontShortName) ?? 'Helvetica';
    const fontEntry = new PdfDict();
    fontEntry.set('/Type', PdfName.of('Font'));
    fontEntry.set('/Subtype', PdfName.of('Type1'));
    fontEntry.set('/BaseFont', PdfName.of(baseFont));
    fontDict.set(`/${fontShortName}`, fontEntry);
  }
  // Always include default Helv
  if (!usedFonts.has('Helv')) {
    const defaultFont = new PdfDict();
    defaultFont.set('/Type', PdfName.of('Font'));
    defaultFont.set('/Subtype', PdfName.of('Type1'));
    defaultFont.set('/BaseFont', PdfName.of('Helvetica'));
    fontDict.set('/Helv', defaultFont);
  }
  resources.set('/Font', fontDict);
  streamDict.set('/Resources', resources);

  return PdfStream.fromString(ops, streamDict);
}

/**
 * Compute the approximate total width of a list of spans.
 */
function computeSpansTotalWidth(spans: RichTextSpan[], defaultFontSize: number): number {
  let total = 0;
  for (const span of spans) {
    const sz = span.fontSize > 0 ? span.fontSize : defaultFontSize;
    total += span.text.length * sz * 0.5;
  }
  return total;
}

/**
 * Split a list of spans into lines at newline characters.
 */
function splitSpansIntoLines(spans: RichTextSpan[]): RichTextSpan[][] {
  const lines: RichTextSpan[][] = [[]];

  for (const span of spans) {
    if (span.text === '\n') {
      lines.push([]);
      continue;
    }

    const parts = span.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      const part = parts[i]!;
      if (part.length > 0) {
        lines.at(-1)!.push({ ...span, text: part });
      }
    }
  }

  return lines;
}

/**
 * Flatten spans by stripping newline characters (for single-line mode).
 */
function flattenSpansRemovingNewlines(spans: RichTextSpan[]): RichTextSpan[] {
  const result: RichTextSpan[] = [];
  for (const span of spans) {
    if (span.text === '\n') continue;
    const text = span.text.replaceAll('\n', ' ');
    if (text.length > 0) {
      result.push({ ...span, text });
    }
  }
  return result;
}

/**
 * Try to generate a rich text appearance for a field.
 *
 * Reads the /RV entry from the field dictionary, parses the XHTML,
 * and generates an appearance stream that reflects the rich text
 * formatting. Returns `undefined` if the field has no /RV or if
 * parsing fails.
 */
function tryRichTextAppearance(field: PdfField): PdfStream | undefined {
  const widgetDict = field.getWidgetDict();
  const dict = field.getDict();

  // Get /RV from the field dict (rich text value is on the field, not widget)
  const rvObj = dict.get('/RV');
  if (rvObj === undefined) return undefined;

  // /RV should be a string
  let rvString: string | undefined;
  if (rvObj.kind === 'string') {
    rvString = (rvObj as PdfString).value;
  }
  if (rvString === undefined || rvString.trim().length === 0) return undefined;

  try {
    const parsed = parseRichTextXhtml(rvString);
    const rect = getWidgetRect(widgetDict);

    // Check if field is multiline
    const ff = numVal(dict.get('/Ff')) ?? 0;
    const multiline = (ff & FieldFlags.Multiline) !== 0;

    // Get default font size from /DA
    let defaultFontSize = 0;
    const daObj = dict.get('/DA');
    if (daObj !== undefined && daObj.kind === 'string') {
      const da = (daObj as PdfString).value;
      const sizeMatch = da.match(/\/\w+\s+([\d.]+)\s+Tf/);
      if (sizeMatch) {
        defaultFontSize = parseFloat(sizeMatch[1]!);
      }
    }

    return generateRichTextAppearance(parsed, rect, multiline, defaultFontSize);
  } catch {
    // Parsing failed — fall back to /V
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

/**
 * Parse an XHTML /RV rich text string into structured paragraphs.
 * Exported for unit testing.
 * @internal
 */
export { parseRichTextXhtml as _parseRichTextXhtml };

/**
 * Generate a rich text appearance stream from parsed XHTML.
 * Exported for unit testing.
 * @internal
 */
export { generateRichTextAppearance as _generateRichTextAppearance };

// ---------------------------------------------------------------------------
// Core flatten logic
// ---------------------------------------------------------------------------

/**
 * Flatten a single field: extract its appearance, build operators,
 * and return the result without mutating any form/page state.
 */
function flattenSingleField(field: PdfField, options: FlattenOptions = {}): FlattenResult {
  const result: FlattenResult = { ops: '', xObjects: [] };

  // Try rich text appearance first (if preserveRichText is not disabled)
  const useRichText = options.preserveRichText !== false;
  let richTextAppearance: PdfStream | undefined;
  if (useRichText && field.fieldType === 'text') {
    richTextAppearance = tryRichTextAppearance(field);
  }

  // Ensure appearance is generated (fallback)
  const generatedAppearance = field.generateAppearance();

  // Try to get an existing appearance stream from the widget dict first
  const widgetDict = field.getWidgetDict();
  const existingAppearance = getAppearanceStream(widgetDict);

  // Priority: rich text > existing appearance > generated appearance
  const appearance = richTextAppearance ?? existingAppearance ?? generatedAppearance;

  const rect = getWidgetRect(widgetDict);

  // Skip zero-area fields
  const w = Math.abs(rect[2] - rect[0]);
  const h = Math.abs(rect[3] - rect[1]);
  if (w <= 0 || h <= 0) return result;

  // Ensure the appearance stream has Form XObject metadata
  if (!appearance.dict.has('/Type')) {
    appearance.dict.set('/Type', PdfName.of('XObject'));
  }
  if (!appearance.dict.has('/Subtype')) {
    appearance.dict.set('/Subtype', PdfName.of('Form'));
  }
  if (!appearance.dict.has('/BBox')) {
    appearance.dict.set('/BBox', PdfArray.fromNumbers([0, 0, w, h]));
  }

  const xObjName = `FlatField${flattenXObjectCounter++}`;
  const ops = buildFlattenOps(xObjName, rect, appearance);

  if (ops.length > 0) {
    result.ops = ops;
    result.xObjects.push({ name: xObjName, stream: appearance });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Flatten ALL form fields into static page content.
 *
 * For each field in the document's AcroForm:
 * 1. Generate / retrieve the field's appearance stream
 * 2. Embed the appearance as a Form XObject in the page's content stream
 * 3. Remove the widget annotation from the page
 * 4. Remove the field from the AcroForm
 *
 * After all fields are processed, the /AcroForm dictionary is cleared.
 *
 * @param form     The document's PdfForm.
 * @param options  Optional flatten options.
 * @returns An object describing the flatten operations performed, suitable
 *          for the caller to apply to page content streams and resources.
 */
export function flattenForm(
  form: PdfForm,
  options: FlattenOptions = {},
): FlattenFormResult {
  const fields = form.getFields();
  return flattenFieldList(form, fields, options, true);
}

/**
 * Flatten a SINGLE field by name.
 *
 * Locates the field in the form, merges its appearance into the page
 * content, removes the widget annotation, and removes the field from
 * the AcroForm's /Fields array. Other fields remain interactive.
 *
 * @param form       The document's PdfForm.
 * @param fieldName  The name of the field to flatten (partial or fully-qualified).
 * @param options    Optional flatten options.
 * @returns An object describing the flatten operations performed.
 * @throws If the field is not found.
 */
export function flattenField(
  form: PdfForm,
  fieldName: string,
  options: FlattenOptions = {},
): FlattenFormResult {
  const field = form.getField(fieldName);
  if (field === undefined) {
    throw new Error(`Form field "${fieldName}" not found.`);
  }
  return flattenFieldList(form, [field], options, false);
}

/**
 * Flatten specific fields by name.
 *
 * @param form        The document's PdfForm.
 * @param fieldNames  Array of field names to flatten.
 * @param options     Optional flatten options.
 * @returns An object describing the flatten operations performed.
 * @throws If any field name is not found.
 */
export function flattenFields(
  form: PdfForm,
  fieldNames: string[],
  options: FlattenOptions = {},
): FlattenFormResult {
  const fields: PdfField[] = [];
  for (const name of fieldNames) {
    const field = form.getField(name);
    if (field === undefined) {
      throw new Error(`Form field "${name}" not found.`);
    }
    fields.push(field);
  }
  return flattenFieldList(form, fields, options, false);
}

/**
 * Result of a form flatten operation.
 *
 * Contains the content stream operators and XObject resources that
 * must be applied to the page(s) to complete the flattening.
 */
export interface FlattenFormResult {
  /** Content stream operators to append to the page. */
  contentOps: string;
  /** XObject name-to-stream pairs to add to page resources. */
  xObjects: Array<{ name: string; stream: PdfStream }>;
  /** Names of fields that were flattened. */
  flattenedFields: string[];
  /** Names of fields that were skipped (e.g. read-only with preserveReadOnly). */
  skippedFields: string[];
  /** Whether the AcroForm was fully removed (all fields flattened). */
  acroFormRemoved: boolean;
}

/**
 * Internal workhorse: flatten a list of fields and optionally
 * clear the AcroForm entirely.
 */
function flattenFieldList(
  form: PdfForm,
  fields: PdfField[],
  options: FlattenOptions,
  removeAcroForm: boolean,
): FlattenFormResult {
  const result: FlattenFormResult = {
    contentOps: '',
    xObjects: [],
    flattenedFields: [],
    skippedFields: [],
    acroFormRemoved: false,
  };

  for (const field of fields) {
    if (shouldSkipField(field, options)) {
      result.skippedFields.push(field.getFullName());
      continue;
    }

    const fieldResult = flattenSingleField(field, options);
    result.contentOps += fieldResult.ops;
    result.xObjects.push(...fieldResult.xObjects);
    result.flattenedFields.push(field.getFullName());

    // Remove the field from the form
    try {
      form.removeField(field.getFullName());
    } catch {
      // Field may already have been removed (e.g. child of radio group)
      // or may not be found by full name; try partial name
      try {
        form.removeField(field.getName());
      } catch {
        // Silently continue — the field will be orphaned
      }
    }
  }

  // If all fields were flattened (removeAcroForm flag), clear the AcroForm.
  // The AcroForm is only fully removed when no fields remain at all —
  // skipped fields (e.g. preserved read-only) keep the AcroForm alive.
  if (removeAcroForm) {
    const remainingFields = form.getFields();
    if (remainingFields.length === 0 && result.skippedFields.length === 0) {
      result.acroFormRemoved = true;
    }
  }

  return result;
}
