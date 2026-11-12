/**
 * Entries for filter-limits.test.ts. The budgeted runner loads this module in a worker and calls
 * one named export with the input bytes and the task's args. Time and memory are counted while the
 * entry runs, so the large inputs are built by the test (passed as `bytes`) unless filling them is a
 * single `fill` call. The module also exports {@link lzwEncode}, which the unit tests import.
 */
import { zlibSync } from 'fflate';
import { PdfArray, PdfDict, PdfName, PdfNumber, PdfStream } from '../../src/core/pdfObjects.js';
import { decodeFlateOnly, decodeStream } from '../../src/parser/streamDecode.js';
import type { JsonValue } from '../helpers/budget.js';

const CLEAR = 256;
const EOD = 257;

/** Options of {@link lzwEncode}. */
export interface LzwEncodeOptions {
  /** Emit a Clear code and restart the table once it holds this many entries; never clears when absent. */
  readonly clearAt?: number;
  /** Codes of the last table entry appended `count` times (12-bit width) before the end code. */
  readonly tail?: { readonly code: number; readonly count: number };
}

/**
 * LZW encoder for the tests: `/EarlyChange 1`, codes from 9 to 12 bits, a table that stops growing at
 * 4096 entries. The table is not reset unless `clearAt` says so.
 */
export function lzwEncode(src: Uint8Array, options: LzwEncodeOptions = {}): Uint8Array {
  const out: number[] = [];
  const table = new Map<number, number>();
  let acc = 0;
  let bits = 0;
  let size = 9;
  let next = 258;

  const emit = (code: number): void => {
    acc = (acc << size) | code;
    bits += size;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >>> bits) & 0xff);
    }
    acc &= (1 << bits) - 1;
  };
  // The decoder holds one entry fewer than the encoder, so its width grows when the
  // encoder's next code reaches the width's capacity.
  const widen = (): void => {
    while (size < 12 && next >= 1 << size) size++;
  };

  emit(CLEAR);
  if (src.length > 0) {
    let w = src[0]!;
    for (let i = 1; i < src.length; i++) {
      const c = src[i]!;
      const key = (w << 8) | c;
      const hit = table.get(key);
      if (hit !== undefined) {
        w = hit;
        continue;
      }
      emit(w);
      if (next < 4096) table.set(key, next++);
      widen();
      if (options.clearAt !== undefined && next >= options.clearAt) {
        emit(CLEAR);
        table.clear();
        next = 258;
        size = 9;
      }
      w = c;
    }
    emit(w);
    if (next < 4096) next++;
    widen();
  }
  if (options.tail) {
    for (let i = 0; i < options.tail.count; i++) emit(options.tail.code);
  }
  emit(EOD);
  if (bits > 0) out.push((acc << (8 - bits)) & 0xff);
  return Uint8Array.from(out);
}

function dictOf(args: Readonly<Record<string, number>>): PdfDict {
  const dict = new PdfDict();
  for (const [key, value] of Object.entries(args)) dict.set(key, PdfNumber.of(value));
  return dict;
}

/** Decodes `bytes` with one filter named by `args.filter`; returns the output length. */
export function decodeOne(bytes: Uint8Array, args: JsonValue): JsonValue {
  const { filter } = args as { filter: string };
  return { length: decodeStream(bytes, filter).length };
}

/** Decodes `bytes` with the filter chain `args.filters`; returns the output length. */
export function decodeChain(bytes: Uint8Array, args: JsonValue): JsonValue {
  const { filters } = args as { filters: string[] };
  return { length: decodeStream(bytes, filters).length };
}

/**
 * Decodes `bytes` with the filter chain `args.filters` and the predictor parameters `args.parms`
 * (one entry per filter, `null` for none); returns the output length.
 */
export function decodeWithParms(bytes: Uint8Array, args: JsonValue): JsonValue {
  const { filters, parms } = args as {
    filters: string[];
    parms: (Record<string, number> | null)[];
  };
  const dicts = parms.map((entries) => (entries === null ? null : dictOf(entries)));
  return { length: decodeStream(bytes, filters, dicts as PdfDict[]).length };
}

/** RunLengthDecode of `args.pairs` runs of 128 bytes (2 input bytes each); returns the output length. */
export function runLengthRuns(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { pairs } = args as { pairs: number };
  const input = new Uint8Array(pairs * 2);
  for (let i = 0; i < input.length; i += 2) {
    input[i] = 129;
    input[i + 1] = 0x41;
  }
  return { length: decodeStream(input, 'RunLengthDecode').length };
}

/** ASCII85Decode of `args.groups` `z` characters (4 output bytes each); returns the output length. */
export function ascii85Zeros(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { groups } = args as { groups: number };
  const input = new Uint8Array(groups).fill(0x7a);
  return { length: decodeStream(input, 'ASCII85Decode').length };
}

/** ASCIIHexDecode of `args.pairs` hex pairs (1 output byte each); returns the output length. */
export function asciiHexPairs(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { pairs } = args as { pairs: number };
  const input = new Uint8Array(pairs * 2 + 1).fill(0x41);
  input[input.length - 1] = 0x3e;
  return { length: decodeStream(input, 'ASCIIHexDecode').length };
}

/**
 * FlateDecode of ten zero bytes with the predictor parameters of `args`, through `decodeStream`
 * (`path: 'stream'`) or through `decodeFlateOnly` (`path: 'flateOnly'`); returns the output length.
 */
export function predictorOnZeros(_bytes: Uint8Array, args: JsonValue): JsonValue {
  const { path, ...parms } = args as { path: 'stream' | 'flateOnly' } & Record<string, number>;
  const data = zlibSync(new Uint8Array(10));
  if (path === 'stream') {
    return { length: decodeStream(data, 'FlateDecode', dictOf(parms)).length };
  }
  const dict = new PdfDict().set('/Filter', PdfArray.of([PdfName.of('FlateDecode')]));
  dict.set('/DecodeParms', dictOf(parms));
  return { length: decodeFlateOnly(new PdfStream(dict, data))?.length ?? -1 };
}

// ---------------------------------------------------------------------------
// Control streams: ordinary input whose output is unchanged by the limits. The unit tests
// (tests/unit/parser/streamDecodeLimits.test.ts) decode them and compare SHA-256 hashes.
// ---------------------------------------------------------------------------

/** One ordinary stream for the unit tests: its filters, parameters and encoded bytes. */
export interface ControlStream {
  readonly name: string;
  readonly filters: string[];
  readonly parms: PdfDict | null;
  readonly data: Uint8Array;
  /** The decoded bytes the stream is built from, when the filter is a plain encoding. */
  readonly source?: Uint8Array;
}

/** `n` bytes of a xorshift32 sequence from `seed`, each reduced modulo `modulo` (256 keeps all bits). */
export function pseudoRandomBytes(seed: number, n: number, modulo = 256): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out[i] = (x >>> 8) % modulo;
  }
  return out;
}

function runLengthEncode(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    let run = 1;
    while (i + run < src.length && src[i + run] === src[i] && run < 128) run++;
    if (run >= 2) {
      out.push(257 - run, src[i]!);
      i += run;
      continue;
    }
    const start = i;
    while (i < src.length && i - start < 128 && !(i + 1 < src.length && src[i] === src[i + 1])) i++;
    out.push(i - start - 1, ...src.subarray(start, i));
  }
  out.push(128);
  return Uint8Array.from(out);
}

function hexEncode(src: Uint8Array): Uint8Array {
  let text = '';
  for (let i = 0; i < src.length; i++) {
    text += (i % 3 === 0 ? ' ' : '') + src[i]!.toString(16).padStart(2, '0');
    if (i % 16 === 15) text += '\n';
  }
  return new TextEncoder().encode(`${text}>`);
}

function ascii85Encode(src: Uint8Array): Uint8Array {
  let text = '';
  for (let i = 0; i < src.length; i += 4) {
    const take = Math.min(4, src.length - i);
    let value = 0;
    for (let k = 0; k < 4; k++) value = value * 256 + (k < take ? src[i + k]! : 0);
    if (take === 4 && value === 0) {
      text += 'z';
      continue;
    }
    const digits: number[] = [];
    for (let k = 0; k < 5; k++) {
      digits.unshift(value % 85);
      value = Math.floor(value / 85);
    }
    text += String.fromCharCode(...digits.slice(0, take + 1).map((d) => d + 33));
    if (i % 60 === 56) text += '\n';
  }
  return new TextEncoder().encode(`${text}~>`);
}

/** PNG-predicted rows of random bytes: one filter byte (cycling 0 to 4) before each row. */
function pngRows(columns: number, colors: number, bpc: number, rows: number): Uint8Array {
  const rowBytes = Math.ceil((columns * colors * bpc) / 8);
  const raw = pseudoRandomBytes(7 + columns, rows * (rowBytes + 1));
  for (let r = 0; r < rows; r++) raw[r * (rowBytes + 1)] = r % 5;
  return raw;
}

/** The control streams, built from fixed seeds. */
export function controlStreams(): ControlStream[] {
  const lowEntropy = pseudoRandomBytes(1, 1024 * 1024, 16);
  const lzwShort = lowEntropy.subarray(0, 200 * 1024);
  const noise = pseudoRandomBytes(2, 64 * 1024);
  const zeroRuns = new Uint8Array(64 * 1024);
  zeroRuns.set(pseudoRandomBytes(3, 4093), 100);
  const controls: ControlStream[] = [
    {
      name: 'lzw-clears',
      filters: ['LZWDecode'],
      parms: null,
      data: lzwEncode(lowEntropy, { clearAt: 4094 }),
      source: lowEntropy,
    },
    {
      name: 'lzw-full-table',
      filters: ['LZWDecode'],
      parms: null,
      data: lzwEncode(lzwShort),
      source: lzwShort,
    },
    {
      name: 'run-length',
      filters: ['RunLengthDecode'],
      parms: null,
      data: runLengthEncode(pseudoRandomBytes(4, 256 * 1024, 4)),
      source: pseudoRandomBytes(4, 256 * 1024, 4),
    },
    {
      name: 'ascii-hex',
      filters: ['ASCIIHexDecode'],
      parms: null,
      data: hexEncode(noise),
      source: noise,
    },
    {
      name: 'ascii85',
      filters: ['ASCII85Decode'],
      parms: null,
      data: ascii85Encode(zeroRuns.subarray(0, 64 * 1024 - 3)),
      source: zeroRuns.subarray(0, 64 * 1024 - 3),
    },
  ];
  for (const [predictor, columns, colors, bpc] of [
    [12, 5, 1, 8],
    [15, 17, 3, 8],
    [11, 33, 1, 1],
    [13, 9, 3, 4],
    [14, 6, 2, 16],
    [10, 7, 4, 2],
    [2, 5, 1, 8],
    [2, 7, 3, 8],
    [2, 6, 2, 16],
    [2, 10, 3, 4],
    [2, 13, 1, 1],
    [2, 11, 2, 2],
  ] as const) {
    const raw =
      predictor === 2
        ? pseudoRandomBytes(5 + columns, 20 * Math.ceil((columns * colors * bpc) / 8))
        : pngRows(columns, colors, bpc, 20);
    controls.push({
      name: `predictor-${predictor}-${columns}-${colors}-${bpc}`,
      filters: ['FlateDecode'],
      parms: dictOf({
        '/Predictor': predictor,
        '/Columns': columns,
        '/Colors': colors,
        '/BitsPerComponent': bpc,
      }),
      data: zlibSync(raw),
    });
  }
  return controls;
}
