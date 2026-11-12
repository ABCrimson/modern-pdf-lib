/**
 * Entries and input builders of the stream /Length adversarial test. Every input is built in code;
 * the entry is what the budgeted runner loads in a worker (tests/helpers/budget.ts): it takes the
 * input bytes and returns a small JSON result.
 */
import { ResourceLimitError } from '../../src/errors.js';
import { loadPdf } from '../../src/index.js';
import type { JsonValue } from '../helpers/budget.js';
import { classicFile, concat, latin1, plainObject, streamObject } from './load-limits.bodies.js';

export { zlibOf } from './load-limits.bodies.js';

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** `loadPdf`: the page count of the loaded document. */
export async function loadEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  const doc = await loadPdf(bytes);
  return { pages: doc.getPageCount() };
}

/**
 * `loadPdf` of an input that ends in a ResourceLimitError: the limit's name, and whether the
 * error was raised while a stream's /Length was being resolved. `loadPdf` reads every object
 * of the file, so a limit that the object holding the /Length exceeds would end the load in the
 * same error even if the /Length path swallowed it; the call chain of the error tells the two
 * apart, because the load itself never gets past the first stream.
 */
export async function loadLimitEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  Error.stackTraceLimit = 200;
  try {
    await loadPdf(bytes);
  } catch (err) {
    if (!(err instanceof ResourceLimitError)) throw err;
    return { limit: err.limit, inLengthPath: /resolveLengthRef/.test(err.stack ?? '') };
  }
  return { limit: null, inLengthPath: false };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const CATALOG = (): Map<number, Uint8Array> =>
  new Map([
    [1, plainObject(1, '<< /Type /Catalog /Pages 2 0 R >>')],
    [2, plainObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')],
    [3, plainObject(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>')],
  ]);

/**
 * A page tree, then `count` stream objects (4 and up) whose `/Length` is 1 and which have no
 * `endstream` and no `endobj` anywhere after their data. With `indirect`, each /Length is a
 * reference to the next stream object.
 */
export function unterminatedStreams(count: number, indirect: boolean): Uint8Array {
  const objects = CATALOG();
  for (let i = 0; i < count; i++) {
    const num = 4 + i;
    const length = indirect ? `${num + 1} 0 R` : '1';
    objects.set(num, latin1(`${num} 0 obj\n<< /Length ${length} >>\nstream\nx\n`));
  }
  return classicFile(objects, () => '/Root 1 0 R').bytes;
}

/**
 * A page tree, then `count` streams (objects 5 and up) whose /Length is `4 0 R`, and object 4,
 * a dictionary of `bytes` bytes that never closes. Object 4 does not parse, so every /Length
 * that names it is unusable; each stream is framed by the search.
 */
export function streamsSharingABrokenLength(count: number, bytes: number): Uint8Array {
  const objects = CATALOG();
  objects.set(4, latin1(`4 0 obj\n<< ${'/A 1 '.repeat(Math.floor(bytes / 5))}\n`));
  for (let i = 0; i < count; i++) {
    const num = 5 + i;
    objects.set(num, latin1(`${num} 0 obj\n<< /Length 4 0 R >>\nstream\nx\nendstream\nendobj\n`));
  }
  return classicFile(objects, () => '/Root 1 0 R').bytes;
}

/**
 * A page whose content stream (object 4) has a wrong /Length, followed by `endstreams` repeated
 * `endstream` lines, then `endobj`.
 */
export function damagedStreamBeforeManyKeywords(totalBytes: number): Uint8Array {
  const objects = CATALOG();
  const line = latin1('endstream\n');
  const lines = new Uint8Array(Math.floor(totalBytes / line.length) * line.length);
  for (let at = 0; at < lines.length; at += line.length) lines.set(line, at);
  objects.set(
    4,
    concat([latin1('4 0 obj\n<< /Length 1 >>\nstream\nBT ET\n'), lines, latin1('endobj\n')]),
  );
  return classicFile(objects, () => '/Root 1 0 R').bytes;
}

/** Rows of an xref stream with /W [1 4 2]. */
const row = (type: number, field2: number, field3: number): number[] => [
  type,
  (field2 >>> 24) & 255,
  (field2 >>> 16) & 255,
  (field2 >>> 8) & 255,
  field2 & 255,
  (field3 >>> 8) & 255,
  field3 & 255,
];

/**
 * A file with an xref stream: `inUse` objects in file order, `compressed` objects (number to
 * `[container, index]`), and the xref stream itself as the last object.
 */
function fileWithXrefStream(
  inUse: ReadonlyMap<number, Uint8Array>,
  compressed: ReadonlyMap<number, readonly [number, number]>,
): Uint8Array {
  const pieces: Uint8Array[] = [latin1('%PDF-1.7\n')];
  const offsets = new Map<number, number>();
  let pos = pieces[0]!.length;
  for (const [num, body] of inUse) {
    offsets.set(num, pos);
    pieces.push(body);
    pos += body.length;
  }
  const xrefNum = Math.max(...inUse.keys(), ...compressed.keys()) + 1;
  offsets.set(xrefNum, pos);
  const rows: number[][] = [];
  for (let num = 0; num <= xrefNum; num++) {
    const packed = compressed.get(num);
    const offset = offsets.get(num);
    if (num === 0) rows.push(row(0, 0, 65535));
    else if (packed !== undefined) rows.push(row(2, packed[0], packed[1]));
    else if (offset !== undefined) rows.push(row(1, offset, 0));
    else rows.push(row(0, 0, 0));
  }
  pieces.push(
    streamObject(
      xrefNum,
      `/Type /XRef /Size ${xrefNum + 1} /W [1 4 2] /Root 1 0 R`,
      Uint8Array.from(rows.flat()),
    ),
    latin1(`startxref\n${pos}\n%%EOF\n`),
  );
  return concat(pieces);
}

/**
 * A page whose content stream (object 4) has /Length `100 0 R`; object 100 sits in object stream
 * 101, whose /Length is `102 0 R` in object stream 103, and so on `depth` levels down. Every
 * object stream is unfiltered. The value of object 100 is `declared`: the default 7 is not the
 * content's length (5), so the content is framed by the search; pass 5 for a chain of right
 * lengths.
 */
export function nestedObjectStreamLengths(depth: number, declared = 7): Uint8Array {
  const inUse = CATALOG();
  const compressed = new Map<number, readonly [number, number]>();
  inUse.set(4, latin1('4 0 obj\n<< /Length 100 0 R >>\nstream\nBT ET\nendstream\nendobj\n'));
  for (let level = 0; level < depth; level++) {
    const length = 100 + 2 * level;
    const container = length + 1;
    const header = `${length} 0 `;
    const data = latin1(`${header}${level === 0 ? declared : 7}`);
    const next = level < depth - 1 ? `${container + 1} 0 R` : String(data.length);
    inUse.set(
      container,
      concat([
        latin1(
          `${container} 0 obj\n<< /Type /ObjStm /N 1 /First ${header.length} /Length ${next} >>\nstream\n`,
        ),
        data,
        latin1('\nendstream\nendobj\n'),
      ]),
    );
    compressed.set(length, [container, 0]);
  }
  return fileWithXrefStream(inUse, compressed);
}

/**
 * A page whose content stream (object 4) has /Length `6 0 R`; object 6 sits in object stream 7,
 * whose Flate data is `zlib` (its decoded form holds `6 0 43` first).
 */
export function lengthInFlateObjectStream(zlib: Uint8Array): Uint8Array {
  const inUse = CATALOG();
  inUse.set(4, latin1('4 0 obj\n<< /Length 6 0 R >>\nstream\nBT ET\nendstream\nendobj\n'));
  inUse.set(7, streamObject(7, '/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode', zlib));
  return fileWithXrefStream(inUse, new Map([[6, [7, 0] as const]]));
}
