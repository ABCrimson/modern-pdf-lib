/**
 * @module jsx/jsxRuntime
 *
 * A framework-agnostic **JSX / hyperscript renderer** that builds a real PDF
 * from a declarative element tree. It supports both the classic `h()` pragma
 * and the React-17+ *automatic runtime* (`jsx` / `jsxs` / `Fragment`), so you
 * can drive it from any JSX toolchain:
 *
 * ```jsonc
 * // tsconfig.json (automatic runtime)
 * { "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "modern-pdf-lib/jsx" } }
 * ```
 * ```jsonc
 * // tsconfig.json (classic runtime)
 * { "compilerOptions": { "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment" } }
 * ```
 *
 * @example Classic pragma
 * ```ts
 * import { h, renderToPdf } from 'modern-pdf-lib/jsx';
 * import { PageSizes } from 'modern-pdf-lib';
 *
 * const bytes = await renderToPdf(
 *   h('document', { size: PageSizes.A4 },
 *     h('page', null,
 *       h('text', { size: 24, bold: true }, 'Invoice'),
 *       h('text', null, 'Thank you for your business.'),
 *     ),
 *   ),
 * );
 * ```
 *
 * ## Intrinsic elements
 *
 * | Tag         | Props                                                              | Meaning |
 * |-------------|--------------------------------------------------------------------|---------|
 * | `document`  | `{ size? }`                                                        | Root container. `size` is the default page size. |
 * | `page`      | `{ size? }`                                                        | Starts a new PDF page (overrides the document size). |
 * | `text`      | `{ x?, y?, size?, color?, bold? }`                                 | Draws one text line. |
 * | `view`      | `{ x?, y?, width?, height?, padding?, background? }`               | A block container; indents/pads its children. |
 * | `rect`      | `{ x, y, width, height, color?, border? }`                        | Draws a rectangle. |
 *
 * Function components are plain `(props) => PdfNode` functions — they are
 * called with their props (children supplied as `props.children`) and their
 * return value is rendered in place. {@link Fragment} groups children without
 * adding any layout box.
 *
 * ## Layout model (simple, by design)
 *
 * This is **not** a flexbox engine. Layout is a deterministic *top-down block
 * flow* per page:
 *
 * - Each `page` maintains a running **y cursor** that starts at
 *   `pageHeight - MARGIN_TOP` and a running **x cursor** at `MARGIN_LEFT`.
 *   Because PDF coordinates are y-up but documents read top-down, the cursor
 *   *decreases* as successive blocks are placed.
 * - A flowed `text` is drawn at the current `(x, y - ascent)` and then advances
 *   the y cursor down by its line height (`size * LINE_HEIGHT_FACTOR`).
 * - A flowed `view` optionally paints its `background`, indents the x cursor by
 *   its `padding`, lays its children out in the same top-down flow, then
 *   restores x and advances y past the consumed block (plus padding).
 * - **Absolute positioning:** if an element supplies an explicit `x` *and* `y`,
 *   it is placed at exactly that PDF coordinate (y-up, measured from the page
 *   bottom) and does **not** consume or advance the flow cursor. A `rect`
 *   (which requires explicit `x`/`y`) is therefore always absolute.
 * - Each `page` element resets both cursors and starts a fresh PDF page.
 *
 * Anything the simple model cannot express (wrapping across pages, automatic
 * text reflow, percentage sizing, z-index) is intentionally out of scope.
 *
 * @packageDocumentation
 */

import { createPdf } from '../core/pdfDocument.js';
import type { PdfDocument } from '../core/pdfDocument.js';
import type { PdfPage, PageSize, FontRef } from '../core/pdfPage.js';
import { PageSizes } from '../core/pdfPage.js';
import type { Color } from '../core/operators/color.js';

// ---------------------------------------------------------------------------
// Public element model
// ---------------------------------------------------------------------------

/**
 * A function component: receives its props (with children under
 * `props.children`) and returns a renderable {@link PdfNode}.
 */
export type PdfComponent = (props: Record<string, unknown>) => PdfNode;

/**
 * A JSX element produced by {@link h} / {@link jsx} / {@link jsxs}.
 */
export interface PdfElement {
  /** Intrinsic tag name (lowercase string) or a function component. */
  type: string | PdfComponent;
  /** Element props (never null after construction). */
  props: Record<string, unknown>;
  /** Flattened child nodes. */
  children: PdfNode[];
}

/**
 * Anything renderable: an element, primitive text/number, or a falsy node
 * (which renders nothing).
 */
export type PdfNode = PdfElement | string | number | null | undefined | boolean;

// ---------------------------------------------------------------------------
// Layout constants (documented in the module header)
// ---------------------------------------------------------------------------

/** Top margin (points) where the flow cursor starts on every page. */
const MARGIN_TOP = 50;
/** Left margin (points) where the flow cursor starts on every page. */
const MARGIN_LEFT = 50;
/** Bottom margin (points); the flow cursor will not draw below this. */
const MARGIN_BOTTOM = 50;
/** Default font size (points) for `text` when `size` is not supplied. */
const DEFAULT_FONT_SIZE = 12;
/** Line-height multiplier applied to a text line's font size. */
const LINE_HEIGHT_FACTOR = 1.2;

// ---------------------------------------------------------------------------
// Hyperscript / JSX factories
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a children argument list into a flat `PdfNode[]`,
 * splatting nested arrays (which JSX produces for `{items.map(...)}`).
 */
function flattenChildren(children: readonly PdfNode[] | PdfNode): PdfNode[] {
  const out: PdfNode[] = [];
  const visit = (node: PdfNode | readonly PdfNode[]): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item as PdfNode);
    } else {
      out.push(node as PdfNode);
    }
  };
  visit(children as PdfNode | readonly PdfNode[]);
  return out;
}

/**
 * Classic hyperscript pragma (`jsxFactory: "h"`).
 *
 * @param type      Intrinsic tag name or a function component.
 * @param props     Props object, or `null` for no props.
 * @param children  Zero or more child nodes (nested arrays are flattened).
 * @returns         A {@link PdfElement}.
 */
export function h(
  type: string | PdfComponent,
  props: Record<string, unknown> | null,
  ...children: PdfNode[]
): PdfElement {
  return {
    type,
    props: props ?? {},
    children: flattenChildren(children),
  };
}

/**
 * Extract the flattened children from an automatic-runtime props object.
 * The JSX automatic runtime passes children inside `props.children`.
 */
function childrenFromProps(props: Record<string, unknown>): {
  rest: Record<string, unknown>;
  children: PdfNode[];
} {
  if (!('children' in props)) {
    return { rest: props, children: [] };
  }
  const { children, ...rest } = props;
  return { rest, children: flattenChildren(children as PdfNode | PdfNode[]) };
}

/**
 * Automatic-runtime factory for elements with a single (or no) child.
 *
 * @param type   Intrinsic tag name or a function component.
 * @param props  Props object; children (if any) live under `props.children`.
 * @returns      A {@link PdfElement}.
 */
export function jsx(
  type: string | PdfComponent,
  props: Record<string, unknown>,
): PdfElement {
  const { rest, children } = childrenFromProps(props);
  return { type, props: rest, children };
}

/**
 * Automatic-runtime factory for elements with multiple static children.
 *
 * Behaviour is identical to {@link jsx}; the JSX transform calls `jsxs` when
 * the children are a static array.
 *
 * @param type   Intrinsic tag name or a function component.
 * @param props  Props object; children live under `props.children`.
 * @returns      A {@link PdfElement}.
 */
export function jsxs(
  type: string | PdfComponent,
  props: Record<string, unknown>,
): PdfElement {
  return jsx(type, props);
}

/**
 * Fragment component — groups children without adding a layout box. Used by
 * the JSX transform for `<>...</>` and directly via `h(Fragment, null, ...)`.
 *
 * @param props  Props whose `children` are returned for rendering.
 * @returns      The children as a {@link PdfNode} (an array, which the
 *               renderer flattens transparently).
 */
export const Fragment: PdfComponent = (props: Record<string, unknown>): PdfNode => {
  // The renderer treats the returned children array as a transparent group.
  return (props['children'] as PdfNode) ?? null;
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Per-page mutable layout cursor. */
interface Cursor {
  /** Current left edge for flowed content (points, page coordinates). */
  x: number;
  /** Current baseline-top for flowed content (points, page coordinates, y-up). */
  y: number;
}

/** Number prop reader that tolerates absent / non-number values. */
function numProp(props: Record<string, unknown>, key: string): number | undefined {
  const v = props[key];
  return typeof v === 'number' ? v : undefined;
}

/** Resolve a `PageSize`-ish value into a concrete `[width, height]`. */
function resolvePageSize(value: unknown, fallback: PageSize): PageSize {
  if (Array.isArray(value) && value.length === 2 &&
      typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [value[0], value[1]] as const;
  }
  if (value && typeof value === 'object' &&
      typeof (value as { width?: unknown }).width === 'number' &&
      typeof (value as { height?: unknown }).height === 'number') {
    return value as { width: number; height: number };
  }
  return fallback;
}

/**
 * Normalize an element/component (or a raw array produced by a component such
 * as {@link Fragment}) into a concrete, flattened array of child nodes.
 */
function resolveNode(input: PdfNode | readonly PdfNode[]): PdfNode[] {
  // A component may have produced a raw array of nodes (e.g. Fragment returns
  // its children array). Flatten it transparently.
  if (Array.isArray(input)) {
    return flattenChildren(input as readonly PdfNode[]);
  }
  const node: PdfNode = input as PdfNode;
  if (node === null || node === undefined || typeof node === 'boolean') {
    return [];
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return [node];
  }
  // Element.
  if (typeof node.type === 'function') {
    const componentProps: Record<string, unknown> = {
      ...node.props,
      children: node.children,
    };
    const produced = node.type(componentProps);
    return flattenChildren(produced);
  }
  return [node];
}

/**
 * Render context shared across a single document render: holds the document,
 * a lazily-embedded default + bold font, and the active page/cursor.
 */
class RenderContext {
  readonly doc: PdfDocument;
  private regular: FontRef | undefined;
  private bold: FontRef | undefined;

  constructor(doc: PdfDocument) {
    this.doc = doc;
  }

  async init(): Promise<void> {
    // Standard-14 fonts: no font bytes required, always available.
    this.regular = await this.doc.embedFont('Helvetica');
    this.bold = await this.doc.embedFont('Helvetica-Bold');
  }

  font(bold: boolean): FontRef {
    const f = bold ? this.bold : this.regular;
    if (f === undefined) {
      // Guarded for completeness: `init()` always runs before any drawing.
      throw new Error('RenderContext.init() must be awaited before rendering.');
    }
    return f;
  }
}

/**
 * Draw a single text line. Returns the height consumed in the flow (0 when the
 * element was absolutely positioned and therefore does not advance the flow).
 */
function renderText(
  ctx: RenderContext,
  page: PdfPage,
  cursor: Cursor,
  el: PdfElement,
): number {
  const props = el.props;
  const size = numProp(props, 'size') ?? DEFAULT_FONT_SIZE;
  const bold = props['bold'] === true;
  const color = props['color'] as Color | undefined;
  const font = ctx.font(bold);

  // The text content is the concatenation of primitive children.
  const text = el.children
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .map((c) => String(c))
    .join('');

  const absX = numProp(props, 'x');
  const absY = numProp(props, 'y');
  const absolute = absX !== undefined && absY !== undefined;

  const lineHeight = size * LINE_HEIGHT_FACTOR;

  if (absolute) {
    page.drawText(text, {
      x: absX,
      y: absY,
      size,
      font,
      ...(color !== undefined ? { color } : {}),
    });
    return 0;
  }

  // Flowed: baseline sits `size` below the current top-of-line cursor.
  const baseline = cursor.y - size;
  page.drawText(text, {
    x: cursor.x,
    y: baseline,
    size,
    font,
    ...(color !== undefined ? { color } : {}),
  });
  cursor.y -= lineHeight;
  return lineHeight;
}

/**
 * Draw a rectangle. `rect` is always absolutely positioned (x/y required) and
 * therefore never advances the flow cursor.
 */
function renderRect(page: PdfPage, el: PdfElement): void {
  const props = el.props;
  const x = numProp(props, 'x') ?? 0;
  const y = numProp(props, 'y') ?? 0;
  const width = numProp(props, 'width') ?? 0;
  const height = numProp(props, 'height') ?? 0;
  const color = props['color'] as Color | undefined;
  const border = props['border'] as Color | undefined;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    ...(color !== undefined ? { color } : {}),
    ...(border !== undefined ? { borderColor: border, borderWidth: 1 } : {}),
  });
}

/**
 * Render a `view` block container. Returns the height consumed in the flow
 * (0 when absolutely positioned).
 */
function renderView(
  ctx: RenderContext,
  page: PdfPage,
  cursor: Cursor,
  el: PdfElement,
): number {
  const props = el.props;
  const padding = numProp(props, 'padding') ?? 0;
  const background = props['background'] as Color | undefined;
  const absX = numProp(props, 'x');
  const absY = numProp(props, 'y');
  const absolute = absX !== undefined && absY !== undefined;
  const explicitWidth = numProp(props, 'width');
  const explicitHeight = numProp(props, 'height');

  if (absolute) {
    // Absolute view: lay children out within their own local cursor starting
    // at the requested top-left, and do not touch the page flow cursor.
    const localTop = absY + (explicitHeight ?? 0);
    const local: Cursor = { x: absX + padding, y: localTop - padding };
    if (background !== undefined && explicitWidth !== undefined && explicitHeight !== undefined) {
      page.drawRectangle({
        x: absX, y: absY, width: explicitWidth, height: explicitHeight, color: background,
      });
    }
    renderChildren(ctx, page, local, el.children);
    return 0;
  }

  // Flowed view: optional background spanning the consumed block, padding
  // indents children, then advance the page cursor past the block.
  const blockTop = cursor.y;
  const innerCursor: Cursor = { x: cursor.x + padding, y: cursor.y - padding };

  renderChildren(ctx, page, innerCursor, el.children);

  const contentConsumed = (cursor.y - padding) - innerCursor.y; // >= 0
  const blockHeight = explicitHeight ?? (contentConsumed + padding * 2);

  if (background !== undefined) {
    const blockWidth = explicitWidth ?? (page.width - cursor.x - MARGIN_LEFT);
    // Paint the background behind the block. (Drawn after children, so it can
    // overlap — acceptable for the simple model; documented as a limitation.)
    page.drawRectangle({
      x: cursor.x,
      y: blockTop - blockHeight,
      width: blockWidth,
      height: blockHeight,
      color: background,
    });
  }

  cursor.y = blockTop - blockHeight;
  return blockHeight;
}

/** Render a flat list of children in top-down flow on the current page. */
function renderChildren(
  ctx: RenderContext,
  page: PdfPage,
  cursor: Cursor,
  children: readonly PdfNode[],
): void {
  for (const child of children) {
    for (const resolved of resolveNode(child)) {
      renderFlowNode(ctx, page, cursor, resolved);
    }
  }
}

/** Render one already-resolved node into the current page's flow. */
function renderFlowNode(
  ctx: RenderContext,
  page: PdfPage,
  cursor: Cursor,
  node: PdfNode,
): void {
  if (node === null || node === undefined || typeof node === 'boolean') return;

  if (typeof node === 'string' || typeof node === 'number') {
    // Bare primitive: render as a default text line.
    const size = DEFAULT_FONT_SIZE;
    const baseline = cursor.y - size;
    page.drawText(String(node), { x: cursor.x, y: baseline, size, font: ctx.font(false) });
    cursor.y -= size * LINE_HEIGHT_FACTOR;
    return;
  }

  // Function components / fragments may resolve to further nodes.
  if (typeof node.type === 'function') {
    for (const resolved of resolveNode(node)) {
      renderFlowNode(ctx, page, cursor, resolved);
    }
    return;
  }

  switch (node.type) {
    case 'text':
      renderText(ctx, page, cursor, node);
      return;
    case 'view':
      renderView(ctx, page, cursor, node);
      return;
    case 'rect':
      renderRect(page, node);
      return;
    case 'page':
    case 'document':
      // Nested page/document inside flow is not meaningful — render its
      // children transparently so content is not silently dropped.
      renderChildren(ctx, page, cursor, node.children);
      return;
    default:
      // Unknown intrinsic: treat as a transparent group of its children.
      renderChildren(ctx, page, cursor, node.children);
      return;
  }
}

/**
 * Collect the `page` elements from a `document`'s children, resolving any
 * function components / fragments that wrap them.
 */
function collectPages(children: readonly PdfNode[]): PdfElement[] {
  const pages: PdfElement[] = [];
  const visit = (node: PdfNode): void => {
    for (const resolved of resolveNode(node)) {
      if (resolved === null || resolved === undefined ||
          typeof resolved === 'boolean' || typeof resolved === 'string' ||
          typeof resolved === 'number') {
        continue;
      }
      if (typeof resolved.type === 'function') {
        visit(resolved);
        continue;
      }
      if (resolved.type === 'page') {
        pages.push(resolved);
      } else {
        // Group wrapper (e.g. a Fragment of pages): descend into its children.
        for (const c of resolved.children) visit(c);
      }
    }
  };
  for (const child of children) visit(child);
  return pages;
}

/**
 * Render a declarative element tree to a PDF document.
 *
 * The `root` should be a `document` element (or a component / fragment that
 * resolves to one). Each `page` child becomes a PDF page; content flows
 * top-down within each page per the layout model documented in the module
 * header.
 *
 * @param root  The root {@link PdfNode} (typically a `document` element).
 * @returns     The serialized PDF as a `Uint8Array` (begins with `"%PDF-"`).
 *
 * @example
 * ```ts
 * const bytes = await renderToPdf(
 *   h('document', { size: PageSizes.A4 },
 *     h('page', null, h('text', { size: 24 }, 'Hello'), h('text', null, 'World')),
 *   ),
 * );
 * ```
 */
export async function renderToPdf(
  root: PdfNode | readonly PdfNode[],
): Promise<Uint8Array> {
  // Resolve the root down to a concrete `document` element (unwrapping any
  // component / fragment layers). An explicit `document` element wins outright;
  // otherwise we synthesize a single document whose children are ALL the
  // resolved top-level element nodes (so a Fragment / array of bare `page`s
  // keeps every page, not just the first).
  let documentEl: PdfElement | undefined;
  const synthesized: PdfElement[] = [];
  const stack = resolveNode(root);
  while (stack.length > 0) {
    const node = stack.shift();
    if (node === null || node === undefined || typeof node === 'boolean' ||
        typeof node === 'string' || typeof node === 'number') {
      continue;
    }
    if (typeof node.type === 'function') {
      // Unwrap a component / fragment layer in place, preserving order.
      stack.unshift(...resolveNode(node));
      continue;
    }
    if (node.type === 'document') {
      // An explicit document wins outright; ignore any synthesized siblings.
      documentEl = node;
      break;
    }
    // A bare `page` (or group) without a `document` wrapper: collect it and
    // keep draining so sibling pages are not discarded.
    synthesized.push(node);
  }
  if (documentEl === undefined && synthesized.length > 0) {
    documentEl = { type: 'document', props: {}, children: synthesized };
  }

  const doc = createPdf();
  const ctx = new RenderContext(doc);
  await ctx.init();

  const docSize = resolvePageSize(documentEl?.props['size'], PageSizes.A4);
  const pageEls = documentEl ? collectPages(documentEl.children) : [];

  // A document with no explicit pages still produces a single blank page so
  // the output is always a structurally valid PDF.
  if (pageEls.length === 0) {
    doc.addPage(docSize);
  }

  for (const pageEl of pageEls) {
    const pageSize = resolvePageSize(pageEl.props['size'], docSize);
    const page = doc.addPage(pageSize);
    const cursor: Cursor = { x: MARGIN_LEFT, y: page.height - MARGIN_TOP };
    renderChildren(ctx, page, cursor, pageEl.children);
    // (MARGIN_BOTTOM is reserved for future overflow handling; the simple
    //  model does not auto-paginate.)
    void MARGIN_BOTTOM;
  }

  return doc.save();
}
