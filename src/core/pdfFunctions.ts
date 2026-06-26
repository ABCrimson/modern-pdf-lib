/**
 * @module core/pdfFunctions
 *
 * PDF function objects and their evaluator (ISO 32000-2 §7.10).
 *
 * PDF functions are reusable, pure mathematical mappings from an
 * `m`-dimensional input domain to an `n`-dimensional output range. They are
 * the shared building block for shadings (§8.7.4.5), transfer functions
 * (§8.4.5), halftones, Separation/DeviceN tint transforms (§8.6.6.4) and
 * soft-mask transfer functions.
 *
 * Four function types are defined by the spec, all supported here:
 *
 * - **Type 0** — sampled functions. A regularly spaced multidimensional table
 *   of samples; output is obtained by (multi-)linear interpolation.
 * - **Type 2** — exponential interpolation between two value vectors `C0` and
 *   `C1` with exponent `N`.
 * - **Type 3** — stitching functions. A 1-input function that partitions its
 *   domain by `Bounds` and dispatches to a list of sub-functions.
 * - **Type 4** — PostScript calculator functions: a restricted, stack-based
 *   PostScript-like language with no I/O or general control flow beyond
 *   `if` / `ifelse`.
 *
 * This module is intentionally free of {@link PdfObject} dependencies: the
 * evaluator works purely on plain numeric definitions so it can be reused by
 * higher-level builders and by rasterisers without coupling to the document
 * object model.
 */

// ---------------------------------------------------------------------------
// Function definition interfaces
// ---------------------------------------------------------------------------

/**
 * Type 0 — sampled function (ISO 32000-2 §7.10.2).
 *
 * Samples are stored row-major with the first input dimension varying
 * fastest, each sample component packed into `bitsPerSample` bits and already
 * decoded into the `[0, 2^bitsPerSample − 1]` integer range as numbers.
 */
export interface SampledFunction {
  readonly functionType: 0;
  /** Input domain `[min0 max0 min1 max1 …]`, two entries per input. */
  readonly domain: readonly number[];
  /** Output range `[min0 max0 …]`, two entries per output component. */
  readonly range: readonly number[];
  /** Number of samples in each input dimension. */
  readonly size: readonly number[];
  /** Bits used to represent each sample component (1,2,4,8,12,16,24,32). */
  readonly bitsPerSample: number;
  /**
   * Flat list of sample component values, row-major, first input dimension
   * varying fastest, output components grouped per grid point.
   */
  readonly samples: readonly number[];
  /** Per-input encode pairs mapping domain → sample-grid coordinates. */
  readonly encode?: readonly number[] | undefined;
  /** Per-output decode pairs mapping raw samples → range. */
  readonly decode?: readonly number[] | undefined;
}

/**
 * Type 2 — exponential interpolation function (ISO 32000-2 §7.10.3).
 *
 * Defines `out[i] = C0[i] + x^N · (C1[i] − C0[i])` for a single clamped
 * input `x`.
 */
export interface ExponentialFunction {
  readonly functionType: 2;
  /** Input domain `[min max]` for the single input. */
  readonly domain: readonly number[];
  /** Output values at `x = 0`; defaults to `[0]`. */
  readonly c0?: readonly number[] | undefined;
  /** Output values at `x = 1`; defaults to `[1]`. */
  readonly c1?: readonly number[] | undefined;
  /** Interpolation exponent `N`. */
  readonly n: number;
}

/**
 * Type 3 — stitching function (ISO 32000-2 §7.10.4).
 *
 * A 1-input function whose domain is split into `k` subdomains by `bounds`;
 * each subdomain dispatches to one of `functions`, after re-encoding the
 * input into that sub-function's domain via `encode`.
 */
export interface StitchingFunction {
  readonly functionType: 3;
  /** Input domain `[min max]`. */
  readonly domain: readonly number[];
  /** The `k` sub-functions. */
  readonly functions: readonly PdfFunctionDef[];
  /** The `k − 1` interior boundary values, strictly increasing. */
  readonly bounds: readonly number[];
  /** `2k` encode values mapping each subdomain to its sub-function domain. */
  readonly encode: readonly number[];
}

/**
 * Type 4 — PostScript calculator function (ISO 32000-2 §7.10.5).
 *
 * `source` is the PostScript program including its enclosing `{ … }`.
 */
export interface PostScriptFunction {
  readonly functionType: 4;
  /** Input domain `[min0 max0 …]`, two entries per input. */
  readonly domain: readonly number[];
  /** Output range `[min0 max0 …]`, two entries per output component. */
  readonly range: readonly number[];
  /** The PostScript calculator source, including the outer braces. */
  readonly source: string;
}

/** Any of the four supported PDF function definitions. */
export type PdfFunctionDef =
  | SampledFunction
  | ExponentialFunction
  | StitchingFunction
  | PostScriptFunction;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Clamp `x` into the inclusive `[lo, hi]` interval. */
function clamp(x: number, lo: number, hi: number): number {
  if (x < lo) {
    return lo;
  }
  if (x > hi) {
    return hi;
  }
  return x;
}

/**
 * Linearly map `x` from `[xMin, xMax]` onto `[yMin, yMax]`.
 *
 * Matches the PDF `Interpolate(x, xmin, xmax, ymin, ymax)` operation
 * (ISO 32000-2 §7.10.2). A degenerate input interval maps to `yMin`.
 */
function interpolate(
  x: number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): number {
  if (xMax === xMin) {
    return yMin;
  }
  return yMin + ((x - xMin) * (yMax - yMin)) / (xMax - xMin);
}

/** Clamp each output component into its `range` pair, when a range is given. */
function clampToRange(out: number[], range: readonly number[]): number[] {
  for (let i = 0; i < out.length; i++) {
    const lo = range[2 * i];
    const hi = range[2 * i + 1];
    if (lo !== undefined && hi !== undefined) {
      out[i] = clamp(out[i] as number, lo, hi);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Type 2 — exponential interpolation
// ---------------------------------------------------------------------------

function evaluateExponential(
  fn: ExponentialFunction,
  inputs: readonly number[],
): number[] {
  const c0 = fn.c0 ?? [0];
  const c1 = fn.c1 ?? [1];
  const x = clamp(inputs[0] ?? 0, fn.domain[0] ?? 0, fn.domain[1] ?? 1);
  const xn = fn.n === 1 ? x : x ** fn.n;
  const count = Math.max(c0.length, c1.length);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = c0[i] ?? 0;
    const b = c1[i] ?? 0;
    out.push(a + xn * (b - a));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Type 3 — stitching
// ---------------------------------------------------------------------------

function evaluateStitching(
  fn: StitchingFunction,
  inputs: readonly number[],
): number[] {
  const d0 = fn.domain[0] ?? 0;
  const d1 = fn.domain[1] ?? 1;
  const x = clamp(inputs[0] ?? 0, d0, d1);

  const k = fn.functions.length;
  // Select sub-function index by Bounds: the first boundary strictly greater
  // than x marks the end of the active subdomain.
  let i = 0;
  while (i < fn.bounds.length && x >= (fn.bounds[i] as number)) {
    i++;
  }
  if (i > k - 1) {
    i = k - 1;
  }

  // Subdomain lower/upper edges for the chosen sub-function.
  const lo = i === 0 ? d0 : (fn.bounds[i - 1] as number);
  const hi = i === fn.bounds.length ? d1 : (fn.bounds[i] as number);

  const eLo = fn.encode[2 * i] ?? 0;
  const eHi = fn.encode[2 * i + 1] ?? 1;
  const encoded = interpolate(x, lo, hi, eLo, eHi);

  const sub = fn.functions[i];
  if (sub === undefined) {
    return [];
  }
  return evaluateFunction(sub, [encoded]);
}

// ---------------------------------------------------------------------------
// Type 0 — sampled function (multilinear interpolation)
// ---------------------------------------------------------------------------

function evaluateSampled(
  fn: SampledFunction,
  inputs: readonly number[],
): number[] {
  const m = fn.size.length;
  const maxSample = 2 ** fn.bitsPerSample - 1;
  const nOut = inferOutputCount(fn);

  // Encode each input into a continuous grid coordinate `e_j ∈ [0, size_j-1]`.
  const e: number[] = [];
  for (let j = 0; j < m; j++) {
    const dMin = fn.domain[2 * j] ?? 0;
    const dMax = fn.domain[2 * j + 1] ?? 1;
    const x = clamp(inputs[j] ?? 0, dMin, dMax);
    const size = fn.size[j] ?? 1;
    const encMin = fn.encode ? (fn.encode[2 * j] ?? 0) : 0;
    const encMax = fn.encode ? (fn.encode[2 * j + 1] ?? size - 1) : size - 1;
    const enc = interpolate(x, dMin, dMax, encMin, encMax);
    e.push(clamp(enc, 0, size - 1));
  }

  // Multilinear interpolation across the 2^m surrounding grid corners.
  const lower: number[] = [];
  const frac: number[] = [];
  for (let j = 0; j < m; j++) {
    const ej = e[j] as number;
    const lo = Math.floor(ej);
    const size = fn.size[j] ?? 1;
    const clampedLo = Math.min(lo, Math.max(0, size - 1));
    lower.push(clampedLo);
    frac.push(ej - clampedLo);
  }

  const out = new Array<number>(nOut).fill(0);
  const corners = 1 << m;
  for (let mask = 0; mask < corners; mask++) {
    let weight = 1;
    const coord: number[] = [];
    for (let j = 0; j < m; j++) {
      const bit = (mask >> j) & 1;
      const size = fn.size[j] ?? 1;
      const lo = lower[j] as number;
      const useHi = bit === 1 && lo + 1 <= size - 1;
      const idx = useHi ? lo + 1 : lo;
      const fr = frac[j] as number;
      // If we cannot move to the high corner, the high contribution collapses
      // onto the low sample, so the bit==1 term carries the same value but its
      // weight is folded in. Skip duplicate corners to avoid double counting.
      if (bit === 1 && !useHi) {
        weight = 0;
        break;
      }
      weight *= bit === 1 ? fr : 1 - fr;
      coord.push(idx);
    }
    if (weight === 0) {
      continue;
    }
    const base = flatIndex(coord, fn.size) * nOut;
    for (let c = 0; c < nOut; c++) {
      out[c] = (out[c] as number) + weight * (fn.samples[base + c] ?? 0);
    }
  }

  // Decode each raw sample value from `[0, maxSample]` into the range/decode.
  for (let c = 0; c < nOut; c++) {
    const dMin = fn.decode ? (fn.decode[2 * c] ?? fn.range[2 * c] ?? 0) : (fn.range[2 * c] ?? 0);
    const dMax = fn.decode
      ? (fn.decode[2 * c + 1] ?? fn.range[2 * c + 1] ?? 1)
      : (fn.range[2 * c + 1] ?? 1);
    out[c] = interpolate(out[c] as number, 0, maxSample, dMin, dMax);
  }

  return clampToRange(out, fn.range);
}

/** Number of output components implied by `range`. */
function inferOutputCount(fn: SampledFunction): number {
  return Math.floor(fn.range.length / 2);
}

/** Row-major flat index of grid coordinate `coord`, first dim varies fastest. */
function flatIndex(coord: readonly number[], size: readonly number[]): number {
  let idx = 0;
  let stride = 1;
  for (let j = 0; j < coord.length; j++) {
    idx += (coord[j] as number) * stride;
    stride *= size[j] ?? 1;
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Type 4 — PostScript calculator
// ---------------------------------------------------------------------------

/** A parsed PostScript token: a number, an operator name, or a nested block. */
type PsToken = number | string | PsToken[];

/**
 * Tokenise a PostScript calculator program into a nested token tree. The outer
 * `{ … }` braces are consumed; the returned array is the top-level program.
 */
function tokenizePostScript(source: string): PsToken[] {
  let i = 0;
  const n = source.length;

  function parseBlock(): PsToken[] {
    const tokens: PsToken[] = [];
    while (i < n) {
      const ch = source[i] as string;
      if (ch === '{') {
        i++;
        tokens.push(parseBlock());
      } else if (ch === '}') {
        i++;
        return tokens;
      } else if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f') {
        i++;
      } else if (ch === '%') {
        // Line comment.
        while (i < n && source[i] !== '\n' && source[i] !== '\r') {
          i++;
        }
      } else {
        let word = '';
        while (
          i < n &&
          !' \t\n\r\f{}%'.includes(source[i] as string)
        ) {
          word += source[i];
          i++;
        }
        const num = Number(word);
        tokens.push(Number.isNaN(num) || word.length === 0 ? word : num);
      }
    }
    return tokens;
  }

  // Skip to first '{' so callers may pass the program with or without leading
  // whitespace; require the standard enclosing braces.
  while (i < n && source[i] !== '{') {
    i++;
  }
  if (source[i] === '{') {
    i++;
    return parseBlock();
  }
  // No braces present — treat the whole source as a bare block.
  i = 0;
  return parseBlock();
}

/** Pop a number from the operand stack, throwing on underflow/type errors. */
function popNum(stack: PsToken[]): number {
  const v = stack.pop();
  if (typeof v !== 'number') {
    throw new Error('PostScript calculator: expected number on stack');
  }
  return v;
}

/** Pop a boolean (represented as a number 0/1 or a boolean) from the stack. */
function popBool(stack: PsToken[]): boolean {
  const v = stack.pop();
  if (typeof v === 'number') {
    return v !== 0;
  }
  if (typeof v === 'boolean') {
    return v;
  }
  throw new Error('PostScript calculator: expected boolean on stack');
}

/** Radians→degrees and degrees→radians factor for trig operators. */
const DEG = 180 / Math.PI;

/** Execute a parsed PostScript token program against an operand stack. */
function execPostScript(program: readonly PsToken[], stack: PsToken[]): void {
  for (let p = 0; p < program.length; p++) {
    const tok = program[p] as PsToken;

    if (typeof tok === 'number') {
      stack.push(tok);
      continue;
    }
    if (Array.isArray(tok)) {
      // A procedure block: push it for a following if/ifelse to consume.
      stack.push(tok);
      continue;
    }

    switch (tok) {
      // --- Arithmetic ---
      case 'add': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a + b);
        break;
      }
      case 'sub': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a - b);
        break;
      }
      case 'mul': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a * b);
        break;
      }
      case 'div': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a / b);
        break;
      }
      case 'idiv': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(Math.trunc(a / b));
        break;
      }
      case 'mod': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a % b);
        break;
      }
      case 'neg':
        stack.push(-popNum(stack));
        break;
      case 'abs':
        stack.push(Math.abs(popNum(stack)));
        break;
      case 'sqrt':
        stack.push(Math.sqrt(popNum(stack)));
        break;
      case 'sin':
        stack.push(Math.sin(popNum(stack) / DEG));
        break;
      case 'cos':
        stack.push(Math.cos(popNum(stack) / DEG));
        break;
      case 'atan': {
        const den = popNum(stack);
        const num = popNum(stack);
        let deg = Math.atan2(num, den) * DEG;
        if (deg < 0) {
          deg += 360;
        }
        stack.push(deg);
        break;
      }
      case 'exp': {
        const exponent = popNum(stack);
        const base = popNum(stack);
        stack.push(base ** exponent);
        break;
      }
      case 'ln':
        stack.push(Math.log(popNum(stack)));
        break;
      case 'log':
        stack.push(Math.log10(popNum(stack)));
        break;
      case 'cvi':
        stack.push(Math.trunc(popNum(stack)));
        break;
      case 'cvr':
        stack.push(popNum(stack));
        break;
      case 'ceiling':
        stack.push(Math.ceil(popNum(stack)));
        break;
      case 'floor':
        stack.push(Math.floor(popNum(stack)));
        break;
      case 'round':
        stack.push(Math.round(popNum(stack)));
        break;
      case 'truncate':
        stack.push(Math.trunc(popNum(stack)));
        break;

      // --- Stack operators ---
      case 'dup': {
        const v = stack[stack.length - 1];
        if (v === undefined) {
          throw new Error('PostScript calculator: dup on empty stack');
        }
        stack.push(v);
        break;
      }
      case 'pop':
        stack.pop();
        break;
      case 'exch': {
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) {
          throw new Error('PostScript calculator: exch underflow');
        }
        stack.push(b, a);
        break;
      }
      case 'copy': {
        const cnt = popNum(stack);
        const len = stack.length;
        for (let c = 0; c < cnt; c++) {
          const v = stack[len - cnt + c];
          if (v === undefined) {
            throw new Error('PostScript calculator: copy underflow');
          }
          stack.push(v);
        }
        break;
      }
      case 'index': {
        const idx = popNum(stack);
        const v = stack[stack.length - 1 - idx];
        if (v === undefined) {
          throw new Error('PostScript calculator: index out of range');
        }
        stack.push(v);
        break;
      }
      case 'roll': {
        const j = popNum(stack);
        const cnt = popNum(stack);
        if (cnt > 0) {
          const start = stack.length - cnt;
          const slice = stack.splice(start, cnt);
          const shift = ((j % cnt) + cnt) % cnt;
          const rolled = slice.slice(cnt - shift).concat(slice.slice(0, cnt - shift));
          for (const v of rolled) {
            stack.push(v);
          }
        }
        break;
      }

      // --- Comparison / boolean ---
      case 'eq':
        stack.push(equalTop(stack) ? 1 : 0);
        break;
      case 'ne':
        stack.push(equalTop(stack) ? 0 : 1);
        break;
      case 'gt': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a > b ? 1 : 0);
        break;
      }
      case 'ge': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a >= b ? 1 : 0);
        break;
      }
      case 'lt': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a < b ? 1 : 0);
        break;
      }
      case 'le': {
        const b = popNum(stack);
        const a = popNum(stack);
        stack.push(a <= b ? 1 : 0);
        break;
      }
      case 'and': {
        const b = popBool(stack);
        const a = popBool(stack);
        stack.push(a && b ? 1 : 0);
        break;
      }
      case 'or': {
        const b = popBool(stack);
        const a = popBool(stack);
        stack.push(a || b ? 1 : 0);
        break;
      }
      case 'xor': {
        const b = popBool(stack);
        const a = popBool(stack);
        stack.push(a !== b ? 1 : 0);
        break;
      }
      case 'not':
        stack.push(popBool(stack) ? 0 : 1);
        break;
      case 'true':
        stack.push(1);
        break;
      case 'false':
        stack.push(0);
        break;

      // --- Conditionals ---
      case 'if': {
        const proc = stack.pop();
        const cond = popBool(stack);
        if (!Array.isArray(proc)) {
          throw new Error('PostScript calculator: if expects a procedure');
        }
        if (cond) {
          execPostScript(proc, stack);
        }
        break;
      }
      case 'ifelse': {
        const procFalse = stack.pop();
        const procTrue = stack.pop();
        const cond = popBool(stack);
        if (!Array.isArray(procTrue) || !Array.isArray(procFalse)) {
          throw new Error('PostScript calculator: ifelse expects two procedures');
        }
        execPostScript(cond ? procTrue : procFalse, stack);
        break;
      }

      default:
        throw new Error(`PostScript calculator: unknown operator '${tok}'`);
    }
  }
}

/** Pop two operands and report whether they are equal (numbers/booleans). */
function equalTop(stack: PsToken[]): boolean {
  const b = stack.pop();
  const a = stack.pop();
  const an = typeof a === 'boolean' ? (a ? 1 : 0) : a;
  const bn = typeof b === 'boolean' ? (b ? 1 : 0) : b;
  return an === bn;
}

function evaluatePostScript(
  fn: PostScriptFunction,
  inputs: readonly number[],
): number[] {
  const program = tokenizePostScript(fn.source);
  const stack: PsToken[] = [];

  const m = Math.floor(fn.domain.length / 2);
  for (let j = 0; j < m; j++) {
    const dMin = fn.domain[2 * j] ?? 0;
    const dMax = fn.domain[2 * j + 1] ?? 1;
    stack.push(clamp(inputs[j] ?? 0, dMin, dMax));
  }

  execPostScript(program, stack);

  const nOut = Math.floor(fn.range.length / 2);
  // The top `nOut` stack entries are the outputs, in order pushed.
  const raw = stack.slice(stack.length - nOut);
  const out = raw.map((v) =>
    typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? v : 0,
  );
  while (out.length < nOut) {
    out.unshift(0);
  }
  return clampToRange(out, fn.range);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Evaluate a PDF function definition at the given input vector.
 *
 * Inputs are clamped to the function's `Domain` and outputs are clamped to its
 * `Range` (when defined), per ISO 32000-2 §7.10. Returns a freshly allocated
 * numeric array of output components.
 *
 * @param fn - the function definition.
 * @param inputs - the `m`-dimensional input vector.
 * @returns the `n`-dimensional output vector.
 */
export function evaluateFunction(
  fn: PdfFunctionDef,
  inputs: readonly number[],
): number[] {
  switch (fn.functionType) {
    case 0:
      return evaluateSampled(fn, inputs);
    case 2:
      return evaluateExponential(fn, inputs);
    case 3:
      return evaluateStitching(fn, inputs);
    case 4:
      return evaluatePostScript(fn, inputs);
    default: {
      // Exhaustiveness guard for future function types.
      const never: never = fn;
      throw new Error(
        `Unsupported PDF function type: ${JSON.stringify(never)}`,
      );
    }
  }
}
