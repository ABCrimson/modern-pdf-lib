/**
 * @module assets/vdom/reconciler
 *
 * A declarative virtual-DOM-to-PDF reconciler.
 *
 * Describe a document as a tree of plain {@link VNode} objects — a
 * `document` containing `page`s, each holding `heading`, `text`, and
 * `spacer` nodes — then hand it to {@link renderToPdf}.  The reconciler
 * walks the tree, lays content out top-to-bottom from the top margin,
 * wraps long runs of text to the content width, and emits saved PDF
 * bytes.  No imperative coordinate bookkeeping required.
 *
 * ```ts
 * import { h, renderToPdf } from 'modern-pdf-lib/assets/vdom';
 *
 * const tree = h('document', {},
 *   h('page', {},
 *     h('heading', { level: 1, text: 'Report' }),
 *     h('text', { text: 'A long paragraph that wraps automatically.' }),
 *   ),
 * );
 * const bytes = await renderToPdf(tree);
 * ```
 */

import type { FontRef } from '../../index.js';
import { createPdf, PageSizes, StandardFonts } from '../../index.js';

// ---------------------------------------------------------------------------
// Virtual node model
// ---------------------------------------------------------------------------

/**
 * A node in the declarative document tree.
 *
 * - `document` — the root; contains `page` children (or loose flow
 *   children that are auto-wrapped into a single page).
 * - `page` — a single physical page; contains flow children.
 * - `heading` — a bold, larger run of text sized by `level` (1 = largest).
 * - `text` — a paragraph of body text, wrapped to the content width.
 * - `spacer` — vertical whitespace of the given `height` in points.
 */
export type VNode =
  | { readonly type: 'document'; readonly children: readonly VNode[] }
  | { readonly type: 'page'; readonly children: readonly VNode[] }
  | { readonly type: 'heading'; readonly level: number; readonly text: string }
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'spacer'; readonly height: number };

/**
 * Options controlling how a {@link VNode} tree is rendered to PDF.
 */
export interface RenderOptions {
  /** Base body font size in points. Default: 12. */
  readonly fontSize?: number | undefined;
  /** Page margin in points applied on all four sides. Default: 50. */
  readonly margin?: number | undefined;
}

// ---------------------------------------------------------------------------
// Hyperscript helper
// ---------------------------------------------------------------------------

/**
 * Construct a well-formed {@link VNode} from a type, a props bag, and
 * child nodes — a hyperscript-style helper.
 *
 * `props` supplies the leaf attributes (`text`, `level`, `height`); the
 * variadic `children` become the node's children for container types.
 * Unknown or missing props fall back to sensible defaults.
 *
 * @param type      The node type to create.
 * @param props     Attribute bag (e.g. `{ text: 'hi', level: 2 }`).
 * @param children  Child nodes for `document` / `page` containers.
 * @returns         A frozen-shaped {@link VNode}.
 */
export function h(
  type: VNode['type'],
  props: Record<string, unknown>,
  ...children: VNode[]
): VNode {
  switch (type) {
    case 'document':
      return { type: 'document', children };
    case 'page':
      return { type: 'page', children };
    case 'heading': {
      const rawLevel = props['level'];
      const level = typeof rawLevel === 'number' && rawLevel >= 1 ? Math.floor(rawLevel) : 1;
      return { type: 'heading', level, text: asText(props['text']) };
    }
    case 'spacer': {
      const rawHeight = props['height'];
      const height = typeof rawHeight === 'number' && rawHeight > 0 ? rawHeight : 0;
      return { type: 'spacer', height };
    }
    case 'text':
    default:
      return { type: 'text', text: asText(props['text']) };
  }
}

/** Coerce an unknown prop value into a string, defaulting to empty. */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// ---------------------------------------------------------------------------
// Reconciler
// ---------------------------------------------------------------------------

/** Internal layout constants. */
const DEFAULT_FONT_SIZE = 12;
const DEFAULT_MARGIN = 50;
const LINE_SPACING = 1.35;
const HEADING_SCALE = [2, 1.6, 1.3, 1.15] as const;

/**
 * Reconcile a {@link VNode} tree into a saved PDF document.
 *
 * The root is normalized to a list of pages: a `document` contributes its
 * `page` children directly, while any loose flow children (or a non-page
 * root) are auto-wrapped into a single page.  Within each page, children
 * flow downward from the top margin; `text` wraps at word boundaries to
 * the content width and `heading` text is rendered larger and bold.
 *
 * @param root     The root node to render.
 * @param options  Optional layout overrides.
 * @returns        A promise resolving to the saved PDF bytes (starting `%PDF-`).
 */
export async function renderToPdf(root: VNode, options?: RenderOptions): Promise<Uint8Array> {
  const fontSize = options?.fontSize ?? DEFAULT_FONT_SIZE;
  const margin = options?.margin ?? DEFAULT_MARGIN;

  const doc = createPdf();
  const body: FontRef = await doc.embedFont(StandardFonts.Helvetica);
  const bold: FontRef = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const pageNode of collectPages(root)) {
    renderPage(doc, body, bold, pageNode, fontSize, margin);
  }

  return doc.save();
}

/**
 * Normalize the root into a flat list of page nodes.
 *
 * Page children of a `document` are kept as-is; any loose flow children
 * are gathered into a synthesized `page`.  A non-`document` root is
 * itself treated as a page (wrapping a leaf if necessary).
 */
function collectPages(root: VNode): VNode[] {
  if (root.type === 'document') {
    const pages: VNode[] = [];
    const loose: VNode[] = [];
    for (const child of root.children) {
      if (child.type === 'page') {
        pages.push(child);
      } else {
        loose.push(child);
      }
    }
    if (loose.length > 0) {
      pages.push({ type: 'page', children: loose });
    }
    if (pages.length === 0) {
      pages.push({ type: 'page', children: [] });
    }
    return pages;
  }

  if (root.type === 'page') {
    return [root];
  }

  // A loose leaf node becomes a single-page document.
  return [{ type: 'page', children: [root] }];
}

/** Mutable cursor tracking the current write position on a page. */
interface Cursor {
  y: number;
  readonly left: number;
  readonly contentWidth: number;
  readonly bottom: number;
}

/**
 * Render the flow children of a single page node onto a fresh PDF page.
 */
function renderPage(
  doc: ReturnType<typeof createPdf>,
  body: FontRef,
  bold: FontRef,
  pageNode: VNode,
  fontSize: number,
  margin: number,
): void {
  const page = doc.addPage(PageSizes.A4);
  const [pageWidth, pageHeight] = PageSizes.A4;

  const cursor: Cursor = {
    y: pageHeight - margin,
    left: margin,
    contentWidth: pageWidth - margin * 2,
    bottom: margin,
  };

  const children = pageNode.type === 'page' || pageNode.type === 'document'
    ? pageNode.children
    : [];

  for (const child of children) {
    switch (child.type) {
      case 'heading':
        drawParagraph(page, bold, child.text, headingSize(child.level, fontSize), cursor);
        break;
      case 'text':
        drawParagraph(page, body, child.text, fontSize, cursor);
        break;
      case 'spacer':
        cursor.y -= child.height;
        break;
      // 'document' / 'page' nested inside a page are ignored (not valid flow content).
      default:
        break;
    }
  }
}

/** Resolve the font size for a heading at the given level. */
function headingSize(level: number, fontSize: number): number {
  const idx = Math.max(0, Math.min(HEADING_SCALE.length - 1, level - 1));
  const scale = HEADING_SCALE.at(idx);
  if (scale === undefined) {
    return fontSize;
  }
  return fontSize * scale;
}

/**
 * Draw a paragraph, wrapping it to the content width and advancing the
 * cursor below the last line. Stops early if the page runs out of space.
 */
function drawParagraph(
  page: ReturnType<ReturnType<typeof createPdf>['addPage']>,
  font: FontRef,
  text: string,
  size: number,
  cursor: Cursor,
): void {
  const lineHeight = size * LINE_SPACING;
  const lines = wrapText(text, font, size, cursor.contentWidth);

  for (const line of lines) {
    if (cursor.y - lineHeight < cursor.bottom) {
      // No more vertical room on this page; drop remaining lines.
      break;
    }
    cursor.y -= lineHeight;
    page.drawText(line, { x: cursor.left, y: cursor.y, font: font.name, size });
  }

  // Add a little gap after the paragraph.
  cursor.y -= size * 0.4;
}

/**
 * Break `text` into lines that each fit within `maxWidth` when rendered
 * with `font` at `size`. Words wider than `maxWidth` are split at the
 * character level so no line overflows.
 */
function wrapText(text: string, font: FontRef, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/u).filter((w) => w.length > 0);
  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = '';
    }

    // The word alone may still exceed the width — break it by character.
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
    } else {
      current = breakLongWord(word, font, size, maxWidth, lines);
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

/**
 * Greedily split a single over-wide word into character chunks that each
 * fit `maxWidth`. Completed chunks are pushed to `lines`; the trailing
 * partial chunk is returned to continue the current line.
 */
function breakLongWord(
  word: string,
  font: FontRef,
  size: number,
  maxWidth: number,
  lines: string[],
): string {
  let chunk = '';
  for (const ch of word) {
    const next = chunk + ch;
    if (chunk.length > 0 && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(chunk);
      chunk = ch;
    } else {
      chunk = next;
    }
  }
  return chunk;
}
