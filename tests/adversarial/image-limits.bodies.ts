/**
 * Entries of image-limits.test.ts, and the builders of the constructed inputs that file and
 * tests/unit/assets/image/imageLimits.test.ts share. The budgeted runner loads this module in a
 * worker and calls one named export with the input bytes and the task's args; each entry runs one
 * public decoder on its input and returns a small summary. The `build*` exports are plain
 * functions that make the inputs; the runner never calls them.
 */
import { zlibSync } from 'fflate';
import { decodeWoff } from '../../src/assets/font/woff.js';
import { embedPng } from '../../src/assets/image/internal/pngEmbed.js';
import { embedTiffDirect } from '../../src/assets/image/tiff/tiffDirectEmbed.js';
import {
  decodeTiff,
  decodeTiffAll,
  getTiffPageCount,
} from '../../src/assets/image/tiff/tiffDecode.js';
import { PdfDict, PdfNumber } from '../../src/core/pdfObjects.js';
import { createPdf } from '../../src/index.js';
import { decodeStream } from '../../src/codecs/streamDecode.js';
import { beginCall } from '../../src/internal/limits.js';
import { DEFAULT_LIMITS } from '../../src/limits.js';
import type { JsonValue } from '../helpers/budget.js';

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

/** `decodeStream` with /CCITTFaxDecode; `args` holds the /K, /Columns and optional /Rows values. */
export function ccittEntry(bytes: Uint8Array, args: JsonValue): JsonValue {
  const { k, columns, rows } = args as { k: number; columns: number; rows?: number };
  const parms = new PdfDict();
  parms.set('/K', PdfNumber.of(k));
  parms.set('/Columns', PdfNumber.of(columns));
  if (rows !== undefined) parms.set('/Rows', PdfNumber.of(rows));
  return { length: decodeStream(bytes, 'CCITTFaxDecode', parms).length };
}

/** `getTiffPageCount`. */
export function tiffPageCountEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { pages: getTiffPageCount(bytes) };
}

/** `decodeTiffAll`. */
export function tiffAllEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { pages: decodeTiffAll(bytes).length };
}

/** `decodeTiff`. */
export function tiffDecodeEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  const image = decodeTiff(bytes);
  return { width: image.width, height: image.height, length: image.pixels.length };
}

/** `PdfDocument.embedTiff`. */
export function tiffEmbedEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  createPdf().embedTiff(bytes);
  return { embedded: true };
}

/** `embedTiffDirect`. */
export function tiffDirectEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: embedTiffDirect(bytes).data.length };
}

/** `embedPng`. */
export function pngEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  const image = embedPng(bytes, beginCall(DEFAULT_LIMITS));
  return { width: image.width, height: image.height };
}

/** `decodeWoff`. */
export function woffEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: decodeWoff(bytes).length };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** One IFD entry: tag, TIFF type (3 SHORT, 4 LONG), count, and the value or the offset of the values. */
export type TiffTag = readonly [tag: number, type: number, count: number, value: number];

/** A little-endian TIFF with one IFD at offset 8 holding `tags`, then `tail` at offset `8 + 2 + 12 * tags.length + 4`. */
export function buildTiff(
  tags: readonly TiffTag[],
  tail: Uint8Array = new Uint8Array(0),
): Uint8Array {
  const out = new Uint8Array(8 + 2 + tags.length * 12 + 4 + tail.length);
  const view = new DataView(out.buffer);
  out.set([0x49, 0x49], 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, tags.length, true);
  tags.forEach(([tag, type, count, value], i) => {
    const at = 10 + i * 12;
    view.setUint16(at, tag, true);
    view.setUint16(at + 2, type, true);
    view.setUint32(at + 4, count, true);
    view.setUint32(at + 8, value, true);
  });
  out.set(tail, 8 + 2 + tags.length * 12 + 4);
  return out;
}

/** A TIFF of `ifds` empty IFDs (no entries); the last one's next-IFD field is `lastNext` (0 ends the chain). */
export function buildTiffChain(ifds: number, lastNext: number = 0): Uint8Array {
  const out = new Uint8Array(8 + ifds * 6);
  const view = new DataView(out.buffer);
  out.set([0x49, 0x49], 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  for (let i = 0; i < ifds; i++) {
    const at = 8 + i * 6;
    view.setUint16(at, 0, true);
    view.setUint32(at + 2, i === ifds - 1 ? lastNext : at + 6, true);
  }
  return out;
}

/**
 * An uncompressed 8-bit TIFF whose tags say `width` x `height` with `samples` samples per pixel and
 * one strip of `strip`; `extraTags` follow the seven standard tags.
 */
export function buildTiffImage(
  width: number,
  height: number,
  samples: number,
  strip: Uint8Array = new Uint8Array(16),
  extraTags: readonly TiffTag[] = [],
): Uint8Array {
  const tagCount = 7 + extraTags.length;
  const dataAt = 8 + 2 + tagCount * 12 + 4;
  return buildTiff(
    [
      [256, 4, 1, width],
      [257, 4, 1, height],
      [258, 3, 1, 8],
      [262, 3, 1, samples === 1 ? 1 : 2],
      [273, 4, 1, dataAt],
      [277, 3, 1, samples],
      [279, 4, 1, strip.length],
      ...extraTags,
    ],
    strip,
  );
}

/** What {@link buildTiffStripped} builds. */
export interface TiffStrippedSpec {
  readonly width: number;
  readonly height: number;
  /** The Compression tag: 1 none, 7 JPEG, 8 Deflate. */
  readonly compression: number;
  /** Rows per strip; the image height when absent. */
  readonly rowsPerStrip?: number;
  /** Number of strips: the length of the list `strips` returns. */
  readonly count: number;
  /**
   * The strips as (offset, byte count) pairs, given the offset of `tail` and the file's length;
   * StripOffsets and StripByteCounts are stored as arrays after the IFD when `count` is above 1.
   */
  readonly strips: (
    tailAt: number,
    fileLength: number,
  ) => ReadonlyArray<readonly [offset: number, count: number]>;
  /** Bytes at the end of the file. */
  readonly tail: Uint8Array;
}

/** A little-endian 8-bit gray TIFF with `spec.count` strips, in the layout {@link TiffStrippedSpec} states. */
export function buildTiffStripped(spec: TiffStrippedSpec): Uint8Array {
  const ifdEnd = 8 + 2 + 9 * 12 + 4;
  const arrays = spec.count > 1 ? 8 * spec.count : 0;
  const tailAt = ifdEnd + arrays;
  const list = spec.strips(tailAt, tailAt + spec.tail.length);
  const first = list[0] ?? [0, 0];
  const body = new Uint8Array(arrays + spec.tail.length);
  const view = new DataView(body.buffer);
  if (spec.count > 1) {
    list.forEach(([offset, count], i) => {
      view.setUint32(4 * i, offset, true);
      view.setUint32(4 * spec.count + 4 * i, count, true);
    });
  }
  body.set(spec.tail, arrays);
  return buildTiff(
    [
      [256, 4, 1, spec.width],
      [257, 4, 1, spec.height],
      [258, 3, 1, 8],
      [259, 3, 1, spec.compression],
      [262, 3, 1, 1],
      [273, 4, spec.count, spec.count > 1 ? ifdEnd : first[0]],
      [277, 3, 1, 1],
      [278, 4, 1, spec.rowsPerStrip ?? spec.height],
      [279, 4, spec.count, spec.count > 1 ? ifdEnd + 4 * spec.count : first[1]],
    ],
    body,
  );
}

/** A PNG of `width` x `height`, 8-bit, colour type `colorType` (2 RGB, 6 RGBA), whose IDAT is `idat`. */
export function buildPng(
  width: number,
  height: number,
  colorType: number,
  idat: Uint8Array,
): Uint8Array {
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    return out;
  };
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width, false);
  view.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** zlib data of `length` zero bytes, built in memory (use it for small sizes only). */
export function zlibOfZeroBytes(length: number): Uint8Array {
  return zlibSync(new Uint8Array(length), { level: 1 });
}

/** One table of a WOFF1 file: stored bytes, and the original length the directory states. */
export interface WoffTable {
  readonly tag: string;
  readonly stored: Uint8Array;
  readonly origLength: number;
}

/** A WOFF1 file with `tables`, whose header says `totalSfntSize` (default: the sum of the original lengths plus the sfnt directory). */
export function buildWoff(tables: readonly WoffTable[], totalSfntSize?: number): Uint8Array {
  const dirEnd = 44 + tables.length * 20;
  const stored = tables.reduce((n, t) => n + t.stored.length, 0);
  const out = new Uint8Array(dirEnd + stored);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x774f4646, false);
  view.setUint32(4, 0x00010000, false);
  view.setUint32(8, out.length, false);
  view.setUint16(12, tables.length, false);
  view.setUint32(
    16,
    totalSfntSize ?? 12 + tables.length * 16 + tables.reduce((n, t) => n + t.origLength, 0),
    false,
  );
  let at = dirEnd;
  tables.forEach((table, i) => {
    const entry = 44 + i * 20;
    for (let c = 0; c < 4; c++) out[entry + c] = table.tag.charCodeAt(c);
    view.setUint32(entry + 4, at, false);
    view.setUint32(entry + 8, table.stored.length, false);
    view.setUint32(entry + 12, table.origLength, false);
    out.set(table.stored, at);
    at += table.stored.length;
  });
  return out;
}

/**
 * A WOFF1 file of `tableCount` tables that all point at one stored blob, each stating `origLength`
 * as its original length (tags are the table numbers, so they differ).
 */
export function buildWoffSharedBlob(
  tableCount: number,
  blob: Uint8Array,
  origLength: number,
): Uint8Array {
  const dirEnd = 44 + tableCount * 20;
  const out = new Uint8Array(dirEnd + blob.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x774f4646, false);
  view.setUint32(4, 0x00010000, false);
  view.setUint32(8, out.length, false);
  view.setUint16(12, tableCount, false);
  view.setUint32(16, 12 + tableCount * 16 + tableCount * origLength, false);
  for (let i = 0; i < tableCount; i++) {
    const entry = 44 + i * 20;
    view.setUint32(entry, 0x41000000 + i, false);
    view.setUint32(entry + 4, dirEnd, false);
    view.setUint32(entry + 8, blob.length, false);
    view.setUint32(entry + 12, origLength, false);
  }
  out.set(blob, dirEnd);
  return out;
}
