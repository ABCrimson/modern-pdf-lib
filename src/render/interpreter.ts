/**
 * @module render/interpreter
 *
 * Executes a parsed PDF content stream through a graphics-state machine,
 * producing a resolution-independent {@link DisplayList} (page space, y-up).
 * This is the foundation the rasterizer and Canvas adapter render from.
 *
 * Supported operators: graphics state (`q`/`Q`/`cm`/`w`/`J`/`j`/`gs`), path
 * construction (`m`/`l`/`c`/`v`/`y`/`re`/`h`), path painting
 * (`f`/`F`/`f*`/`S`/`s`/`B`/`B*`/`b`/`b*`/`n`), clipping (`W`/`W*`), color
 * (`rg`/`RG`/`g`/`G`/`k`/`K`/`cs`/`CS`/`sc`/`scn`/`SC`/`SCN`), text
 * (`BT`/`ET`/`Tf`/`Td`/`TD`/`Tm`/`T*`/`Tc`/`Tw`/`Tz`/`TL`/`Ts`/`Tr`/`Tj`/`TJ`/`'`/`"`),
 * and XObjects (`Do`, recursing into form XObjects). Bézier curves are
 * flattened to polylines.
 *
 * @packageDocumentation
 */

import { type Matrix, identity, multiply, applyToPoint, translation, meanScale } from './matrix.js';
import type { DisplayList, DisplayItem, SubPath, Rgba } from './displayList.js';
import type { ContentStreamOperator, Operand } from '../parser/contentStreamParser.js';
import { cmykToRgb } from '../core/operators/color.js';
import { PdfName, PdfDict, PdfStream, type PdfObject, type PdfObjectRegistry } from '../core/pdfObjects.js';
import { parseContentStream } from '../parser/contentStreamParser.js';
import { decodeStreamData } from '../parser/streamDecode.js';
import type { PdfPage } from '../core/pdfPage.js';

/** Options for {@link interpretContentStream}. */
export interface InterpretOptions {
  /** Page (crop/media box) width in user-space units. */
  width: number;
  /** Page (crop/media box) height in user-space units. */
  height: number;
  /** Page-space origin (crop/media box lower-left). Default `[0, 0]`. */
  origin?: readonly [number, number] | undefined;
  /** Page `/Resources` dict, for `Do`/`Tf` resolution. */
  resources?: PdfDict | undefined;
  /** Object registry, to resolve indirect resource refs. */
  registry?: PdfObjectRegistry | undefined;
}

interface GraphicsState {
  ctm: Matrix;
  fill: Rgba;
  stroke: Rgba;
  lineWidth: number;
  lineCap: 0 | 1 | 2;
  lineJoin: 0 | 1 | 2;
  fillAlpha: number;
  strokeAlpha: number;
  clip: readonly SubPath[] | undefined;
  // text state
  font: string | undefined;
  fontSize: number;
  charSpace: number;
  wordSpace: number;
  hScale: number;
  leading: number;
  rise: number;
  renderMode: number;
}

function initialState(): GraphicsState {
  return {
    ctm: identity(),
    fill: [0, 0, 0, 255],
    stroke: [0, 0, 0, 255],
    lineWidth: 1,
    lineCap: 0,
    lineJoin: 0,
    fillAlpha: 1,
    strokeAlpha: 1,
    clip: undefined,
    font: undefined,
    fontSize: 0,
    charSpace: 0,
    wordSpace: 0,
    hScale: 1,
    leading: 0,
    rise: 0,
    renderMode: 0,
  };
}

function cloneState(s: GraphicsState): GraphicsState {
  return { ...s };
}

// ---------------------------------------------------------------------------
// Operand / color helpers
// ---------------------------------------------------------------------------

function num(op: Operand | undefined): number {
  return typeof op === 'number' ? op : 0;
}

function nameOf(op: Operand | undefined): string | undefined {
  if (op instanceof PdfName) return op.value.replace(/^\//, '');
  if (typeof op === 'string') return op.replace(/^\//, '');
  return undefined;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function grayRgba(g: number): Rgba {
  const v = clamp255(g);
  return [v, v, v, 255];
}

function rgbRgba(r: number, g: number, b: number): Rgba {
  return [clamp255(r), clamp255(g), clamp255(b), 255];
}

function cmykRgba(c: number, m: number, y: number, k: number): Rgba {
  const [r, g, b] = cmykToRgb(c, m, y, k);
  return [clamp255(r), clamp255(g), clamp255(b), 255];
}

/** Interpret `sc`/`scn` numeric components by arity → RGBA. */
function componentsToRgba(comps: number[]): Rgba | undefined {
  if (comps.length === 1) return grayRgba(comps[0]!);
  if (comps.length === 3) return rgbRgba(comps[0]!, comps[1]!, comps[2]!);
  if (comps.length === 4) return cmykRgba(comps[0]!, comps[1]!, comps[2]!, comps[3]!);
  return undefined;
}

// ---------------------------------------------------------------------------
// Bézier flattening
// ---------------------------------------------------------------------------

const BEZIER_STEPS = 16;

function flattenCubic(
  out: number[],
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
): void {
  for (let i = 1; i <= BEZIER_STEPS; i++) {
    const t = i / BEZIER_STEPS;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    out.push(
      a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
      a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    );
  }
}

// ---------------------------------------------------------------------------
// Interpreter
// ---------------------------------------------------------------------------

/**
 * Execute a parsed content stream into a {@link DisplayList}.
 *
 * @param operators - Output of {@link parseContentStream}.
 * @param options   - Page dimensions and (optional) resources/registry.
 */
export function interpretContentStream(
  operators: readonly ContentStreamOperator[],
  options: InterpretOptions,
): DisplayList {
  const items: DisplayItem[] = [];
  const origin = options.origin ?? [0, 0];
  interpretInto(items, operators, initialState(), options, 0);
  return { items, width: options.width, height: options.height, origin };
}

const MAX_FORM_DEPTH = 12;

function interpretInto(
  items: DisplayItem[],
  operators: readonly ContentStreamOperator[],
  startState: GraphicsState,
  options: InterpretOptions,
  depth: number,
): void {
  const stack: GraphicsState[] = [];
  let gs = startState;

  // Current path under construction (page space).
  let path: { points: number[]; closed: boolean }[] = [];
  let cur: number[] | null = null;
  let curUser: [number, number] = [0, 0]; // last point in user space
  let curPage: [number, number] = [0, 0]; // last point in page space
  let pendingClip: 'nonzero' | 'evenodd' | null = null;

  // Text matrices.
  let tm: Matrix = identity();
  let tlm: Matrix = identity();

  const startSub = (x: number, y: number): void => {
    if (cur && cur.length >= 4) path.push({ points: cur, closed: false });
    curUser = [x, y];
    curPage = applyToPoint(gs.ctm, x, y);
    cur = [curPage[0], curPage[1]];
  };
  const lineTo = (x: number, y: number): void => {
    if (!cur) startSub(x, y);
    curUser = [x, y];
    curPage = applyToPoint(gs.ctm, x, y);
    cur!.push(curPage[0], curPage[1]);
  };
  const finishPath = (): { points: number[]; closed: boolean }[] => {
    if (cur && cur.length >= 4) path.push({ points: cur, closed: false });
    const result = path;
    path = [];
    cur = null;
    return result;
  };
  const applyClipIfPending = (subs: { points: number[]; closed: boolean }[]): void => {
    if (pendingClip) {
      gs = { ...gs, clip: subs.map((s) => ({ points: s.points.slice(), closed: true })) };
      pendingClip = null;
    }
  };
  // Flush the in-progress sub-path (if it has ≥2 points) into `path`, then reset
  // `cur`. Defined as a closure so `cur` keeps its `number[] | null` type
  // (the main-loop `cur = null` writes would otherwise narrow it to `never`).
  const pushOpen = (closed: boolean): void => {
    if (cur && cur.length >= 4) path.push({ points: cur, closed });
    cur = null;
  };

  for (const { operator, operands } of operators) {
    switch (operator) {
      // --- graphics state ---
      case 'q':
        stack.push(cloneState(gs));
        break;
      case 'Q':
        if (stack.length) gs = stack.pop()!;
        break;
      case 'cm':
        gs = {
          ...gs,
          ctm: multiply(
            [num(operands[0]), num(operands[1]), num(operands[2]), num(operands[3]), num(operands[4]), num(operands[5])],
            gs.ctm,
          ),
        };
        break;
      case 'w':
        gs = { ...gs, lineWidth: num(operands[0]) };
        break;
      case 'J':
        gs = { ...gs, lineCap: (num(operands[0]) | 0) as 0 | 1 | 2 };
        break;
      case 'j':
        gs = { ...gs, lineJoin: (num(operands[0]) | 0) as 0 | 1 | 2 };
        break;
      case 'gs':
        gs = applyExtGState(gs, nameOf(operands[0]), options);
        break;

      // --- color ---
      case 'rg':
        gs = { ...gs, fill: rgbRgba(num(operands[0]), num(operands[1]), num(operands[2])) };
        break;
      case 'RG':
        gs = { ...gs, stroke: rgbRgba(num(operands[0]), num(operands[1]), num(operands[2])) };
        break;
      case 'g':
        gs = { ...gs, fill: grayRgba(num(operands[0])) };
        break;
      case 'G':
        gs = { ...gs, stroke: grayRgba(num(operands[0])) };
        break;
      case 'k':
        gs = { ...gs, fill: cmykRgba(num(operands[0]), num(operands[1]), num(operands[2]), num(operands[3])) };
        break;
      case 'K':
        gs = { ...gs, stroke: cmykRgba(num(operands[0]), num(operands[1]), num(operands[2]), num(operands[3])) };
        break;
      case 'sc':
      case 'scn': {
        const comps = operands.filter((o): o is number => typeof o === 'number');
        const rgba = componentsToRgba(comps);
        if (rgba) gs = { ...gs, fill: rgba };
        break;
      }
      case 'SC':
      case 'SCN': {
        const comps = operands.filter((o): o is number => typeof o === 'number');
        const rgba = componentsToRgba(comps);
        if (rgba) gs = { ...gs, stroke: rgba };
        break;
      }

      // --- path construction ---
      case 'm':
        startSub(num(operands[0]), num(operands[1]));
        break;
      case 'l':
        lineTo(num(operands[0]), num(operands[1]));
        break;
      case 'c': {
        if (!cur) startSub(curUser[0], curUser[1]);
        const p1 = applyToPoint(gs.ctm, num(operands[0]), num(operands[1]));
        const p2 = applyToPoint(gs.ctm, num(operands[2]), num(operands[3]));
        const p3 = applyToPoint(gs.ctm, num(operands[4]), num(operands[5]));
        flattenCubic(cur!, curPage, p1, p2, p3);
        curUser = [num(operands[4]), num(operands[5])];
        curPage = p3;
        break;
      }
      case 'v': {
        if (!cur) startSub(curUser[0], curUser[1]);
        const p2 = applyToPoint(gs.ctm, num(operands[0]), num(operands[1]));
        const p3 = applyToPoint(gs.ctm, num(operands[2]), num(operands[3]));
        flattenCubic(cur!, curPage, curPage, p2, p3);
        curUser = [num(operands[2]), num(operands[3])];
        curPage = p3;
        break;
      }
      case 'y': {
        if (!cur) startSub(curUser[0], curUser[1]);
        const p1 = applyToPoint(gs.ctm, num(operands[0]), num(operands[1]));
        const p3 = applyToPoint(gs.ctm, num(operands[2]), num(operands[3]));
        flattenCubic(cur!, curPage, p1, p3, p3);
        curUser = [num(operands[2]), num(operands[3])];
        curPage = p3;
        break;
      }
      case 're': {
        const x = num(operands[0]);
        const y = num(operands[1]);
        const w = num(operands[2]);
        const h = num(operands[3]);
        pushOpen(false);
        const corners = [
          applyToPoint(gs.ctm, x, y),
          applyToPoint(gs.ctm, x + w, y),
          applyToPoint(gs.ctm, x + w, y + h),
          applyToPoint(gs.ctm, x, y + h),
        ];
        path.push({ points: corners.flat(), closed: true });
        cur = null;
        curUser = [x, y];
        curPage = corners[0]!;
        break;
      }
      case 'h':
        pushOpen(true);
        break;

      // --- path painting ---
      case 'f':
      case 'F':
      case 'f*': {
        const subs = finishPath();
        emitFill(items, subs, operator === 'f*' ? 'evenodd' : 'nonzero', gs);
        applyClipIfPending(subs);
        break;
      }
      case 'S':
      case 's': {
        if (operator === 's') pushOpen(true);
        const subs = finishPath();
        emitStroke(items, subs, gs);
        applyClipIfPending(subs);
        break;
      }
      case 'B':
      case 'B*':
      case 'b':
      case 'b*': {
        if (operator === 'b' || operator === 'b*') pushOpen(true);
        const subs = finishPath();
        emitFill(items, subs, operator === 'B*' || operator === 'b*' ? 'evenodd' : 'nonzero', gs);
        emitStroke(items, subs, gs);
        applyClipIfPending(subs);
        break;
      }
      case 'n': {
        const subs = finishPath();
        applyClipIfPending(subs);
        break;
      }
      case 'W':
        pendingClip = 'nonzero';
        break;
      case 'W*':
        pendingClip = 'evenodd';
        break;

      // --- text ---
      case 'BT':
        tm = identity();
        tlm = identity();
        break;
      case 'ET':
        break;
      case 'Tf':
        gs = { ...gs, font: nameOf(operands[0]), fontSize: num(operands[1]) };
        break;
      case 'Tc':
        gs = { ...gs, charSpace: num(operands[0]) };
        break;
      case 'Tw':
        gs = { ...gs, wordSpace: num(operands[0]) };
        break;
      case 'Tz':
        gs = { ...gs, hScale: num(operands[0]) / 100 };
        break;
      case 'TL':
        gs = { ...gs, leading: num(operands[0]) };
        break;
      case 'Ts':
        gs = { ...gs, rise: num(operands[0]) };
        break;
      case 'Tr':
        gs = { ...gs, renderMode: num(operands[0]) | 0 };
        break;
      case 'Td': {
        tlm = multiply(translation(num(operands[0]), num(operands[1])), tlm);
        tm = tlm;
        break;
      }
      case 'TD': {
        gs = { ...gs, leading: -num(operands[1]) };
        tlm = multiply(translation(num(operands[0]), num(operands[1])), tlm);
        tm = tlm;
        break;
      }
      case 'Tm':
        tm = [num(operands[0]), num(operands[1]), num(operands[2]), num(operands[3]), num(operands[4]), num(operands[5])];
        tlm = tm;
        break;
      case 'T*':
        tlm = multiply(translation(0, -gs.leading), tlm);
        tm = tlm;
        break;
      case 'Tj':
        tm = showText(items, textString(operands[0]), tm, gs);
        break;
      case 'TJ': {
        const arr = Array.isArray(operands[0]) ? operands[0] : [];
        let combined = '';
        for (const el of arr) {
          if (typeof el === 'number') {
            // negative adjustment moves right; advance tm
            tm = multiply(translation((-el / 1000) * gs.fontSize * gs.hScale, 0), tm);
          } else {
            combined += textString(el);
            tm = showText(items, textString(el), tm, gs);
          }
        }
        void combined;
        break;
      }
      case "'": {
        tlm = multiply(translation(0, -gs.leading), tlm);
        tm = tlm;
        tm = showText(items, textString(operands[0]), tm, gs);
        break;
      }
      case '"': {
        gs = { ...gs, wordSpace: num(operands[0]), charSpace: num(operands[1]) };
        tlm = multiply(translation(0, -gs.leading), tlm);
        tm = tlm;
        tm = showText(items, textString(operands[2]), tm, gs);
        break;
      }

      // --- XObjects ---
      case 'Do':
        doXObject(items, nameOf(operands[0]), gs, options, depth);
        break;

      default:
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Emit helpers
// ---------------------------------------------------------------------------

function freeze(subs: { points: number[]; closed: boolean }[]): SubPath[] {
  return subs.map((s) => ({ points: s.points, closed: s.closed }));
}

function emitFill(
  items: DisplayItem[],
  subs: { points: number[]; closed: boolean }[],
  rule: 'nonzero' | 'evenodd',
  gs: GraphicsState,
): void {
  if (!subs.length) return;
  items.push({ type: 'fill', subpaths: freeze(subs), rule, color: gs.fill, alpha: gs.fillAlpha, clip: gs.clip });
}

function emitStroke(
  items: DisplayItem[],
  subs: { points: number[]; closed: boolean }[],
  gs: GraphicsState,
): void {
  if (!subs.length) return;
  items.push({
    type: 'stroke',
    subpaths: freeze(subs),
    color: gs.stroke,
    alpha: gs.strokeAlpha,
    lineWidth: Math.max(gs.lineWidth * meanScale(gs.ctm), 0.1),
    lineCap: gs.lineCap,
    lineJoin: gs.lineJoin,
    clip: gs.clip,
  });
}

/** Decode a content-stream string operand to text (best-effort latin-1/WinAnsi). */
function textString(op: Operand | undefined): string {
  return typeof op === 'string' ? op : '';
}

/** Emit a text run and advance the text matrix by an approximate width. */
function showText(items: DisplayItem[], text: string, tm: Matrix, gs: GraphicsState): Matrix {
  if (text.length) {
    items.push({
      type: 'text',
      text,
      font: gs.font,
      fontSize: gs.fontSize,
      transform: multiply(multiply([gs.fontSize * gs.hScale, 0, 0, gs.fontSize, 0, gs.rise], tm), gs.ctm),
      color: gs.fill,
      alpha: gs.fillAlpha,
      renderMode: gs.renderMode,
      clip: gs.clip,
    });
  }
  // Approximate advance: average glyph width ≈ 0.5em (no font metrics here).
  let w = 0;
  for (const ch of text) {
    w += 0.5 * gs.fontSize + gs.charSpace + (ch === ' ' ? gs.wordSpace : 0);
  }
  return multiply(translation(w * gs.hScale, 0), tm);
}

// ---------------------------------------------------------------------------
// Resource resolution (ExtGState, XObject)
// ---------------------------------------------------------------------------

function resolve(obj: PdfObject | undefined, options: InterpretOptions): PdfObject | undefined {
  if (obj && obj.kind === 'ref' && options.registry) return options.registry.resolve(obj);
  return obj;
}

function subDict(resources: PdfDict | undefined, key: string, options: InterpretOptions): PdfDict | undefined {
  if (!resources) return undefined;
  const d = resolve(resources.get(key), options);
  return d && d.kind === 'dict' ? (d as PdfDict) : undefined;
}

function applyExtGState(gs: GraphicsState, name: string | undefined, options: InterpretOptions): GraphicsState {
  if (!name) return gs;
  const egs = subDict(options.resources, '/ExtGState', options);
  const dict = egs ? resolve(egs.get('/' + name), options) : undefined;
  if (!dict || dict.kind !== 'dict') return gs;
  const d = dict as PdfDict;
  const ca = resolve(d.get('/ca'), options);
  const CA = resolve(d.get('/CA'), options);
  const LW = resolve(d.get('/LW'), options);
  const next = { ...gs };
  if (ca && ca.kind === 'number') next.fillAlpha = (ca as { value: number }).value;
  if (CA && CA.kind === 'number') next.strokeAlpha = (CA as { value: number }).value;
  if (LW && LW.kind === 'number') next.lineWidth = (LW as { value: number }).value;
  return next;
}

function doXObject(
  items: DisplayItem[],
  name: string | undefined,
  gs: GraphicsState,
  options: InterpretOptions,
  depth: number,
): void {
  if (!name) return;
  const xobjects = subDict(options.resources, '/XObject', options);
  const xobj = xobjects ? resolve(xobjects.get('/' + name), options) : undefined;
  if (!xobj || xobj.kind !== 'stream') {
    // Unresolved: still record the placement so callers know an image was here.
    items.push({ type: 'image', name, transform: gs.ctm, alpha: gs.fillAlpha, clip: gs.clip });
    return;
  }
  const stream = xobj as PdfStream;
  const subtype = stream.dict.get('/Subtype');
  const subtypeName = subtype instanceof PdfName ? subtype.value.replace(/^\//, '') : '';

  if (subtypeName === 'Form' && depth < MAX_FORM_DEPTH) {
    // Recurse into the form: concat its /Matrix, swap in its /Resources.
    const matrixObj = resolve(stream.dict.get('/Matrix'), options);
    let formCtm = gs.ctm;
    if (matrixObj && matrixObj.kind === 'array') {
      const m = (matrixObj as { items: PdfObject[] }).items.map((o) =>
        o && o.kind === 'number' ? (o as { value: number }).value : 0,
      );
      if (m.length === 6) formCtm = multiply(m as unknown as Matrix, gs.ctm);
    }
    const formResources = subDict(stream.dict, '/Resources', options) ?? options.resources;
    try {
      const formOps = parseContentStream(decodeStreamData(stream));
      const formState: GraphicsState = { ...gs, ctm: formCtm };
      interpretInto(items, formOps, formState, { ...options, resources: formResources }, depth + 1);
    } catch {
      // ignore malformed form content
    }
    return;
  }

  // Image XObject (or unknown subtype): record placement (unit square → page).
  items.push({ type: 'image', name, transform: gs.ctm, alpha: gs.fillAlpha, clip: gs.clip });
}

/**
 * Interpret a {@link PdfPage}'s content into a {@link DisplayList}, using its
 * crop/media box for dimensions and its resources/registry for `Do`/`gs`/`Tf`
 * resolution. The entry point for {@link renderPageToImage} et al.
 */
export function interpretPage(page: PdfPage): DisplayList {
  const box = page.getCropBox() ?? page.getMediaBox();
  const operators = parseContentStream(page.getContentStream());
  return interpretContentStream(operators, {
    width: box.width,
    height: box.height,
    origin: [box.x, box.y],
    resources: page.getOriginalResources(),
    registry: page.getRegistry(),
  });
}
