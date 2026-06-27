/**
 * @module render/displayList
 *
 * A resolution-independent intermediate representation produced by the
 * content-stream interpreter ({@link module:render/interpreter}) and consumed
 * by the rasterizer and Canvas adapter.
 *
 * All geometry is in **page space** — PDF user space with the page's CTM and
 * every `cm` already applied, y-axis up, origin at the page's lower-left. A
 * renderer maps page space to its target by applying a single scale + y-flip,
 * so one display list renders at any DPI.
 *
 * @packageDocumentation
 */

import type { Matrix } from './matrix.js';

/** An 8-bit RGBA color, each channel `0–255`. */
export type Rgba = readonly [number, number, number, number];

/**
 * A flattened sub-path: an array of page-space coordinates as a flat
 * `[x0, y0, x1, y1, …]` polyline. Bézier curves are flattened to line segments
 * by the interpreter.
 */
export interface SubPath {
  /** Flat `[x, y, …]` page-space points. */
  readonly points: readonly number[];
  /** Whether the sub-path is closed (last point joins the first). */
  readonly closed: boolean;
}

/** A filled region. */
export interface FillItem {
  readonly type: 'fill';
  readonly subpaths: readonly SubPath[];
  /** Winding rule (`f`/`B` → nonzero, `f*`/`B*` → evenodd). */
  readonly rule: 'nonzero' | 'evenodd';
  readonly color: Rgba;
  /** Constant alpha from the graphics state (`ca`), `0–1`. */
  readonly alpha: number;
  /** Active clip path (page space), if any. */
  readonly clip?: readonly SubPath[] | undefined;
}

/** A stroked path. */
export interface StrokeItem {
  readonly type: 'stroke';
  readonly subpaths: readonly SubPath[];
  readonly color: Rgba;
  readonly alpha: number;
  /** Line width in page-space units (the user-space width × CTM scale). */
  readonly lineWidth: number;
  readonly lineCap: 0 | 1 | 2;
  readonly lineJoin: 0 | 1 | 2;
  readonly clip?: readonly SubPath[] | undefined;
}

/** A positioned text run (a `Tj`/`TJ`/`'`/`"` show). */
export interface TextItem {
  readonly type: 'text';
  /** The decoded Unicode text (best-effort via ToUnicode / WinAnsi). */
  readonly text: string;
  /** The resource font name (e.g. `F1`), or `undefined` if unresolved. */
  readonly font: string | undefined;
  /** Font size in text-space units. */
  readonly fontSize: number;
  /** Text-space → page-space transform at the run's origin (Tm × CTM). */
  readonly transform: Matrix;
  /** Fill color (text render modes 0/2/4/6). */
  readonly color: Rgba;
  readonly alpha: number;
  /** Text rendering mode (Tr), `0–7`; `3`/`7` are invisible (§9.3.3). */
  readonly renderMode: number;
  readonly clip?: readonly SubPath[] | undefined;
}

/** A placed image XObject (`Do`) or inline image (`BI…EI`). */
export interface ImageItem {
  readonly type: 'image';
  /** Resource XObject name, or `inline` for an inline image. */
  readonly name: string;
  /** Unit-square `(0,0)–(1,1)` → page-space placement (the CTM at `Do`). */
  readonly transform: Matrix;
  readonly alpha: number;
  readonly clip?: readonly SubPath[] | undefined;
}

/** Any drawable produced by the interpreter. */
export type DisplayItem = FillItem | StrokeItem | TextItem | ImageItem;

/** The full interpreted page: drawables in paint order + page dimensions. */
export interface DisplayList {
  /** Drawables in paint order (first = painted first / bottom-most). */
  readonly items: readonly DisplayItem[];
  /** Page width in user-space units (from the crop/media box). */
  readonly width: number;
  /** Page height in user-space units. */
  readonly height: number;
  /** Page-space origin offset (crop/media box lower-left), for renderers. */
  readonly origin: readonly [number, number];
}
