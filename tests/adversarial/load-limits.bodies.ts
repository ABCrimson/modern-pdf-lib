/**
 * Entries and input builders of the load-limits adversarial test. The builders make every input in
 * code with node:zlib (tests/unit/parser/loadLimits.test.ts and the inspector, scanner and auto-tag
 * unit tests import them too); the entries are what the budgeted runner loads in a worker
 * (tests/helpers/budget.ts): each takes the input bytes and returns a small JSON result.
 */
import { Buffer } from 'node:buffer';
import { createDeflate, deflateSync } from 'node:zlib';
import { autoTagPage } from '../../src/accessibility/autoTag.js';
import { loadPdf } from '../../src/index.js';
import { inspectEncryption } from '../../src/security/encryptionInspector.js';
import { scanPdfThreats } from '../../src/security/threatScanner.js';
import type { JsonValue } from '../helpers/budget.js';

const MIB = 1024 * 1024;

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

/** `inspectEncryption`: whether the file reports as encrypted. */
export async function inspectEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  return { encrypted: (await inspectEncryption(bytes)).encrypted };
}

/** `scanPdfThreats`: the risk level and the finding categories. */
export async function scanEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  const report = await scanPdfThreats(bytes);
  return { riskLevel: report.riskLevel, categories: report.findings.map((f) => f.category) };
}

/** Loads the file and tags page 0: the element counts. */
export async function autoTagEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  const result = autoTagPage(await loadPdf(bytes), 0);
  return { headings: result.headings, paragraphs: result.paragraphs, elements: result.elements };
}

/** Loads the file and decodes the content stream of page 0: its length. */
export async function contentLengthEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  return { length: (await loadPdf(bytes)).getPage(0).getContentStream().length };
}

/** Loads the file: its page count. */
export async function pageCountEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  return { pages: (await loadPdf(bytes)).getPageCount() };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** The bytes of `text`, one byte per character (Latin-1). */
export const latin1 = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'latin1'));

/** The parts joined into one array. */
export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** zlib data (level 1) of `head` followed by `mib` MiB of the byte `fill`, written a MiB at a time. */
export async function zlibOf(head: Uint8Array, mib: number, fill: number): Promise<Uint8Array> {
  const deflater = createDeflate({ level: 1 });
  const parts: Buffer[] = [];
  deflater.on('data', (part: Buffer) => parts.push(part));
  const ended = new Promise<void>((done) => deflater.on('end', done));
  deflater.write(head);
  const block = Buffer.alloc(MIB, fill);
  for (let i = 0; i < mib; i++) {
    if (!deflater.write(block)) await new Promise((done) => deflater.once('drain', done));
  }
  deflater.end();
  await ended;
  return new Uint8Array(Buffer.concat(parts));
}

/** One indirect object `num 0 obj << dict >> stream data endstream` (the /Length is added). */
export function streamObject(num: number, dict: string, data: Uint8Array): Uint8Array {
  return concat([
    latin1(`${num} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`),
    data,
    latin1('\nendstream\nendobj\n'),
  ]);
}

/** One indirect object `num 0 obj body endobj`. */
export const plainObject = (num: number, body: string): Uint8Array =>
  latin1(`${num} 0 obj\n${body}\nendobj\n`);

/**
 * A file of `objects` (by object number; a missing number is a free entry) with a classic
 * cross-reference table, a trailer holding `trailerEntries`, and the offsets of the objects
 * returned beside the bytes.
 */
export function classicFile(
  objects: ReadonlyMap<number, Uint8Array>,
  trailerEntries: (offsets: ReadonlyMap<number, number>) => string,
): { bytes: Uint8Array; offsets: Map<number, number> } {
  const pieces: Uint8Array[] = [latin1('%PDF-1.7\n')];
  const offsets = new Map<number, number>();
  let pos = pieces[0]!.length;
  for (const [num, body] of objects) {
    offsets.set(num, pos);
    pieces.push(body);
    pos += body.length;
  }
  const size = Math.max(...objects.keys()) + 1;
  let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let num = 1; num < size; num++) {
    const offset = offsets.get(num);
    table +=
      offset === undefined
        ? '0000000000 65535 f \n'
        : `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pieces.push(
    latin1(
      `${table}trailer\n<< /Size ${size} ${trailerEntries(offsets)} >>\nstartxref\n${pos}\n%%EOF\n`,
    ),
  );
  return { bytes: concat(pieces), offsets };
}

const HEX32 = '00112233445566778899aabbccddeeff';

/**
 * An encrypted file (a Standard /Encrypt dictionary) whose newest section is a classic table and
 * whose /Prev is a cross-reference stream: `xrefStream` is that stream's zlib data. Decoded above
 * the limit it is a bomb; a small one gives an ordinary file that reports as encrypted.
 */
export function encryptedFileWithXrefStream(xrefStream: Uint8Array): Uint8Array {
  const long = HEX32 + HEX32;
  const objects = new Map<number, Uint8Array>([
    [1, plainObject(1, '<< /Type /Catalog /Pages 2 0 R >>')],
    [2, plainObject(2, '<< /Type /Pages /Kids [] /Count 0 >>')],
    [
      3,
      plainObject(
        3,
        `<< /Filter /Standard /V 2 /R 3 /Length 128 /O <${long}> /U <${long}> /P -4 >>`,
      ),
    ],
    [
      4,
      streamObject(
        4,
        '/Type /XRef /Size 5 /W [1 4 2] /Index [0 1] /Root 1 0 R /Filter /FlateDecode',
        xrefStream,
      ),
    ],
  ]);
  return classicFile(
    objects,
    (offsets) => `/Root 1 0 R /Encrypt 3 0 R /ID [<${HEX32}> <${HEX32}>] /Prev ${offsets.get(4)}`,
  ).bytes;
}

/**
 * A file whose catalog, with a JavaScript /OpenAction, sits in object stream 10, and whose object 3
 * sits in object stream 11, a second one: `second` is that stream's zlib data. Decoded above the
 * limit it is a bomb; a small one gives a file that reports the open action.
 */
export function openActionFileWithSecondObjectStream(second: Uint8Array): Uint8Array {
  const catalog =
    '<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>';
  const pages = '<< /Type /Pages /Kids [] /Count 0 >>';
  const header = `1 0 2 ${catalog.length + 1} `;
  const first = new Uint8Array(deflateSync(latin1(`${header}${catalog} ${pages}`)));
  const a = streamObject(
    10,
    `/Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode`,
    first,
  );
  const b = streamObject(11, '/Type /ObjStm /N 1 /First 4 /Filter /FlateDecode', second);
  const offsetA = 9;
  const offsetB = offsetA + a.length;
  const xrefAt = offsetB + b.length;
  const row = (type: number, field2: number, field3: number): number[] => [
    type,
    (field2 >>> 24) & 255,
    (field2 >>> 16) & 255,
    (field2 >>> 8) & 255,
    field2 & 255,
    (field3 >>> 8) & 255,
    field3 & 255,
  ];
  const rows = [row(0, 0, 65535), row(2, 10, 0), row(2, 10, 1), row(2, 11, 0)];
  for (let num = 4; num < 10; num++) rows.push(row(0, 0, 0));
  rows.push(row(1, offsetA, 0), row(1, offsetB, 0), row(1, xrefAt, 0));
  const table = Uint8Array.from(rows.flat());
  return concat([
    latin1('%PDF-1.7\n'),
    a,
    b,
    streamObject(12, '/Type /XRef /Size 13 /W [1 4 2] /Root 1 0 R', table),
    latin1(`startxref\n${xrefAt}\n%%EOF\n`),
  ]);
}

/**
 * A one-page file with text and a chain of `depth` distinct Form XObjects, each calling the next
 * `calls` times (the last paints a rectangle); with `depth` 0 the page holds the text only.
 */
export function pageWithFormChain(depth: number, calls: number): Uint8Array {
  const objects = new Map<number, Uint8Array>([
    [1, plainObject(1, '<< /Type /Catalog /Pages 2 0 R >>')],
    [2, plainObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')],
    [
      3,
      plainObject(
        3,
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R ' +
          '/Resources << /Font << /F1 5 0 R >> /XObject << /N 10 0 R >> >> >>',
      ),
    ],
    [
      4,
      streamObject(
        4,
        '',
        latin1(
          `BT /F1 12 Tf 72 700 Td (Hello world from the page) Tj ET${depth > 0 ? ' /N Do' : ''}`,
        ),
      ),
    ],
    [5, plainObject(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')],
  ]);
  for (let level = 0; level < depth; level++) {
    const num = 10 + level;
    const last = level === depth - 1;
    const resources = last ? '' : ` /Resources << /XObject << /N ${num + 1} 0 R >> >>`;
    objects.set(
      num,
      streamObject(
        num,
        `/Type /XObject /Subtype /Form /BBox [0 0 10 10]${resources}`,
        latin1(last ? '0 0 1 1 re f' : '/N Do '.repeat(calls)),
      ),
    );
  }
  return classicFile(objects, () => '/Root 1 0 R').bytes;
}

/** A one-page file whose /Contents lists object 4 `refs` times; object 4 is a /FlateDecode stream whose data is `zlib` (see {@link zlibOf}). */
export function pageWithRepeatedContent(zlib: Uint8Array, refs: number): Uint8Array {
  const objects = new Map<number, Uint8Array>([
    [1, plainObject(1, '<< /Type /Catalog /Pages 2 0 R >>')],
    [2, plainObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')],
    [
      3,
      plainObject(
        3,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents [${'4 0 R '.repeat(refs)}] >>`,
      ),
    ],
    [4, streamObject(4, '/Filter /FlateDecode', zlib)],
  ]);
  return classicFile(objects, () => '/Root 1 0 R').bytes;
}

/**
 * A file in the layout of the loader tests: object stream 1 holds the catalog, the page tree and
 * the page (objects 2 to 4), and cross-reference stream 5 locates them. The object stream's
 * /N is 3, and its header (`2 0 3 x 4 y`) is followed by `headerPad` bytes of the repeated tokens
 * `100 0 ` before the members start at /First.
 */
export async function objectStreamWithLongHeader(headerPad: number): Promise<Uint8Array> {
  const members = [
    '<< /Type /Catalog /Pages 3 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 200 200] >>',
  ];
  let body = '';
  const offsets: number[] = [];
  for (const member of members) {
    offsets.push(body.length);
    body += `${member}\n`;
  }
  const header = `2 ${offsets[0]} 3 ${offsets[1]} 4 ${offsets[2]} ${'100 0 '.repeat(Math.ceil(headerPad / 6))}`;
  const stream = await zlibOf(latin1(header + body), 0, 0);
  const prefix = latin1('%PDF-1.7\n');
  const objStm = streamObject(
    1,
    `/Type /ObjStm /N 3 /First ${header.length} /Filter /FlateDecode`,
    stream,
  );
  const off1 = prefix.length;
  const off5 = off1 + objStm.length;
  const rows: [number, number, number][] = [
    [0, 0, 255],
    [1, off1, 0],
    [2, 1, 0],
    [2, 1, 1],
    [2, 1, 2],
    [1, off5, 0],
  ];
  const table = new Uint8Array(rows.length * 4);
  rows.forEach(([type, field2, field3], i) => {
    table[i * 4] = type;
    table[i * 4 + 1] = (field2 >> 8) & 0xff;
    table[i * 4 + 2] = field2 & 0xff;
    table[i * 4 + 3] = field3;
  });
  return concat([
    prefix,
    objStm,
    streamObject(5, '/Type /XRef /Size 6 /W [1 2 1] /Root 2 0 R', table),
    latin1(`startxref\n${off5}\n%%EOF\n`),
  ]);
}

/**
 * A file whose page tree is a chain of `levels` nodes: each /Pages node has the next as its only
 * kid, and the last node is the /Page. The chain is `levels` nodes deep.
 */
export function pageTreeChain(levels: number): Uint8Array {
  const objects = new Map<number, Uint8Array>([
    [1, plainObject(1, '<< /Type /Catalog /Pages 2 0 R >>')],
  ]);
  for (let level = 1; level <= levels; level++) {
    const num = level + 1;
    objects.set(
      num,
      plainObject(
        num,
        level === levels
          ? `<< /Type /Page /Parent ${num - 1} 0 R /MediaBox [0 0 200 200] >>`
          : `<< /Type /Pages /Kids [${num + 1} 0 R] /Count 1 >>`,
      ),
    );
  }
  return classicFile(objects, () => '/Root 1 0 R').bytes;
}
