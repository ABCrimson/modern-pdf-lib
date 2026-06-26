/**
 * @module assets/markdown/markdownToPdf
 *
 * Render a CommonMark **subset** to a PDF document.
 *
 * This is a deliberately small, dependency-free Markdown renderer intended
 * for turning simple documents (READMEs, notes, generated reports) into a
 * laid-out PDF.  It does not aim to be a full CommonMark implementation —
 * it understands the most common block constructs:
 *
 * - **ATX headings** (`#` … `######`) → larger, bold text
 * - **Paragraphs** → wrapped body text
 * - **Unordered list items** (`-` / `*` / `+`) → bullet lines
 * - **Fenced code blocks** (```` ``` ````) → monospace (Courier) block
 *
 * Lines are laid out top-to-bottom within page margins.  Long lines wrap to
 * the available text width, and a new page is started whenever the cursor
 * runs below the bottom margin.
 *
 * @example
 * ```ts
 * import { markdownToPdf } from 'modern-pdf-lib/assets/markdown';
 *
 * const bytes = await markdownToPdf('# Title\n\nHello **world**\n\n- one\n- two');
 * // bytes is a Uint8Array beginning with the "%PDF-" header.
 * ```
 */

import { createPdf, PageSizes, StandardFonts } from '../../index.js';
import type { FontRef } from '../../index.js';
import type { PdfDocument } from '../../index.js';
import type { PdfPage } from '../../index.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options controlling {@link markdownToPdf} layout.
 */
export interface MarkdownToPdfOptions {
  /** Base body font size in points.  Defaults to `12`. */
  readonly fontSize?: number | undefined;
  /** Page margin in points applied to all four sides.  Defaults to `50`. */
  readonly margin?: number | undefined;
  /**
   * Line-height multiplier applied to the font size of each rendered line.
   * Defaults to `1.4`.
   */
  readonly lineHeight?: number | undefined;
}

/**
 * Convert a CommonMark **subset** string into PDF bytes.
 *
 * @param markdown  The Markdown source text.
 * @param options   Optional layout options ({@link MarkdownToPdfOptions}).
 * @returns         A promise resolving to the saved PDF as a `Uint8Array`.
 */
export async function markdownToPdf(
  markdown: string,
  options?: MarkdownToPdfOptions,
): Promise<Uint8Array> {
  const fontSize = options?.fontSize ?? 12;
  const margin = options?.margin ?? 50;
  const lineHeightFactor = options?.lineHeight ?? 1.4;

  const doc: PdfDocument = createPdf();
  const regular: FontRef = await doc.embedFont(StandardFonts.Helvetica);
  const bold: FontRef = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono: FontRef = await doc.embedFont(StandardFonts.Courier);

  const [pageWidth, pageHeight] = PageSizes.A4;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = margin;

  const layout = new Layout(doc, pageWidth, pageHeight, margin, bottomLimit, lineHeightFactor);

  const blocks = parseBlocks(normalizeNewlines(markdown));

  for (const block of blocks) {
    renderBlock(block, layout, { regular, bold, mono, fontSize, contentWidth });
  }

  return doc.save();
}

// ---------------------------------------------------------------------------
// Block model
// ---------------------------------------------------------------------------

type Block =
  | { readonly kind: 'heading'; readonly level: number; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list-item'; readonly text: string }
  | { readonly kind: 'code'; readonly lines: readonly string[] }
  | { readonly kind: 'blank' };

/** Replace CRLF / CR with LF so line parsing is uniform. */
function normalizeNewlines(input: string): string {
  return input.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

/**
 * Parse a Markdown subset into an ordered list of block-level constructs.
 *
 * Recognises ATX headings, fenced code blocks, unordered list items, blank
 * lines (used as paragraph separators), and paragraph text.
 */
function parseBlocks(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];

  let inCode = false;
  let codeLines: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphLines.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraphLines.join(' ') });
      paragraphLines = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();

    // Fenced code block toggling.
    if (trimmed.startsWith('```')) {
      if (inCode) {
        blocks.push({ kind: 'code', lines: codeLines });
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Blank line → paragraph break.
    if (trimmed.length === 0) {
      flushParagraph();
      blocks.push({ kind: 'blank' });
      continue;
    }

    // ATX heading (# .. ######).
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      const hashes = headingMatch[1] ?? '';
      const text = (headingMatch[2] ?? '').trim();
      blocks.push({ kind: 'heading', level: hashes.length, text });
      continue;
    }

    // Unordered list item (-, *, +).
    const listMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      blocks.push({ kind: 'list-item', text: (listMatch[1] ?? '').trim() });
      continue;
    }

    // Otherwise accumulate into the current paragraph.
    paragraphLines.push(trimmed);
  }

  // Close any unterminated code fence / trailing paragraph.
  if (inCode && codeLines.length > 0) {
    blocks.push({ kind: 'code', lines: codeLines });
  }
  flushParagraph();

  return blocks;
}

/** Strip the most common inline emphasis markers for plain-text rendering. */
function stripInline(text: string): string {
  return text
    .replaceAll('**', '')
    .replaceAll('__', '')
    .replaceAll('`', '');
}

// ---------------------------------------------------------------------------
// Layout engine
// ---------------------------------------------------------------------------

/**
 * Tracks the current page and vertical cursor, adding pages as needed.
 * @internal
 */
class Layout {
  private page: PdfPage;
  private y: number;

  constructor(
    private readonly doc: PdfDocument,
    private readonly pageWidth: number,
    private readonly pageHeight: number,
    private readonly margin: number,
    private readonly bottomLimit: number,
    private readonly lineHeightFactor: number,
  ) {
    this.page = this.doc.addPage(PageSizes.A4);
    this.y = this.pageHeight - this.margin;
  }

  /** Left edge of the text area. */
  get left(): number {
    return this.margin;
  }

  /** Advance to a new page, resetting the cursor to the top margin. */
  private newPage(): void {
    this.page = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.y = this.pageHeight - this.margin;
  }

  /** Add vertical spacing without drawing anything (e.g. between blocks). */
  addGap(size: number): void {
    this.y -= size * this.lineHeightFactor;
    if (this.y < this.bottomLimit) {
      this.newPage();
    }
  }

  /**
   * Draw one line of text, advancing the cursor and paginating as required.
   *
   * @param text  The (already wrapped) single line of text.
   * @param font  The font to render with.
   * @param size  The font size in points.
   * @param x     The x position (defaults to the left text edge).
   */
  drawLine(text: string, font: FontRef, size: number, x?: number): void {
    const advance = size * this.lineHeightFactor;
    if (this.y - advance < this.bottomLimit) {
      this.newPage();
    }
    this.y -= advance;
    this.page.drawText(text, {
      x: x ?? this.left,
      y: this.y,
      font: font.name,
      size,
    });
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

interface RenderContext {
  readonly regular: FontRef;
  readonly bold: FontRef;
  readonly mono: FontRef;
  readonly fontSize: number;
  readonly contentWidth: number;
}

/** Heading font size for each ATX level (1–6). */
function headingSize(level: number, base: number): number {
  const scale = [2.0, 1.7, 1.4, 1.2, 1.1, 1.0];
  const idx = Math.min(Math.max(level, 1), 6) - 1;
  return Math.round(base * (scale[idx] ?? 1.0));
}

/** Render a single parsed block into the layout. */
function renderBlock(block: Block, layout: Layout, ctx: RenderContext): void {
  switch (block.kind) {
    case 'blank': {
      layout.addGap(ctx.fontSize * 0.5);
      return;
    }
    case 'heading': {
      const size = headingSize(block.level, ctx.fontSize);
      const lines = wrapText(stripInline(block.text), ctx.bold, size, ctx.contentWidth);
      layout.addGap(ctx.fontSize * 0.4);
      for (const line of lines) {
        layout.drawLine(line, ctx.bold, size);
      }
      return;
    }
    case 'paragraph': {
      const lines = wrapText(stripInline(block.text), ctx.regular, ctx.fontSize, ctx.contentWidth);
      for (const line of lines) {
        layout.drawLine(line, ctx.regular, ctx.fontSize);
      }
      return;
    }
    case 'list-item': {
      const bulletWidth = ctx.regular.widthOfTextAtSize('• ', ctx.fontSize);
      const lines = wrapText(
        stripInline(block.text),
        ctx.regular,
        ctx.fontSize,
        ctx.contentWidth - bulletWidth,
      );
      const [first, ...rest] = lines;
      layout.drawLine(`• ${first ?? ''}`, ctx.regular, ctx.fontSize);
      for (const line of rest) {
        layout.drawLine(line, ctx.regular, ctx.fontSize, layout.left + bulletWidth);
      }
      return;
    }
    case 'code': {
      layout.addGap(ctx.fontSize * 0.3);
      for (const codeLine of block.lines) {
        const wrapped = wrapText(codeLine, ctx.mono, ctx.fontSize, ctx.contentWidth);
        // A blank code line still consumes one line of vertical space.
        if (wrapped.length === 0) {
          layout.drawLine('', ctx.mono, ctx.fontSize);
        }
        for (const line of wrapped) {
          layout.drawLine(line, ctx.mono, ctx.fontSize);
        }
      }
      layout.addGap(ctx.fontSize * 0.3);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Word wrapping
// ---------------------------------------------------------------------------

/**
 * Break a string into lines that each fit within `maxWidth` for the given
 * font and size.  Wrapping happens at spaces; words longer than `maxWidth`
 * are broken at the character level so nothing overflows the page.
 */
function wrapText(text: string, font: FontRef, size: number, maxWidth: number): string[] {
  if (text.length === 0) {
    return [];
  }
  const limit = maxWidth > 0 ? maxWidth : font.widthOfTextAtSize('M', size);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const lines: string[] = [];
  let current = '';

  const pushCurrent = (): void => {
    if (current.length > 0) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= limit) {
      current = candidate;
      continue;
    }

    // The candidate is too wide.  Flush what we have, then place the word.
    pushCurrent();

    if (font.widthOfTextAtSize(word, size) <= limit) {
      current = word;
    } else {
      // Word alone exceeds the line width — break it character by character.
      for (const piece of breakLongWord(word, font, size, limit)) {
        lines.push(piece);
      }
      const last = lines.pop();
      current = last ?? '';
    }
  }

  pushCurrent();
  return lines.length > 0 ? lines : [text];
}

/** Split a single over-long word into character-level chunks that fit. */
function breakLongWord(word: string, font: FontRef, size: number, limit: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const ch of word) {
    const candidate = current + ch;
    if (current.length > 0 && font.widthOfTextAtSize(candidate, size) > limit) {
      chunks.push(current);
      current = ch;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}
