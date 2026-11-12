/**
 * Tests for the stream compression shared by the PDF writers.
 *
 * Every /FlateDecode result is judged by node:zlib `inflateSync`, which checks the zlib header
 * and the Adler-32 trailer. A document loaded from a file whose trailer has /Encrypt keeps its
 * /FlateDecode data on save: the tests build such a file around data from a fixed seed that
 * node:zlib `inflateRawSync` accepts, with the /Encrypt entry indirect or direct and with a
 * cross-reference table the loader rebuilds by a scan, and a control file without /Encrypt. Two
 * encrypted files written by qpdf, loaded with their password and with `ignoreEncryption`, keep
 * the stream data of the input file.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deflateRawSync,
  deflateSync as zlibDeflateSync,
  inflateRawSync,
  inflateSync,
} from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { deflateSync as fflateRaw } from 'fflate';
import {
  LEGACY_REWRAP_MAX_SIZE,
  compressPdfStream,
  rewrapLegacyStream,
} from '../../../src/core/flateStream.js';
import { PdfArray, PdfDict, PdfName, PdfNumber, PdfStream } from '../../../src/core/pdfObjects.js';
import { loadPdf } from '../../../src/index.js';

const encoder = new TextEncoder();
const latin1 = new TextDecoder('latin1');

/** A content stream long enough to compress well. */
const TEXT = encoder.encode(
  Array.from({ length: 40 }, (_, i) => `BT /F1 12 Tf 50 ${750 - i * 14} Td (Line ${i}) Tj ET`).join(
    '\n',
  ),
);

function streamOf(data: Uint8Array, filter?: PdfName | PdfArray): PdfStream {
  const dict = new PdfDict();
  if (filter !== undefined) dict.set('/Filter', filter);
  return PdfStream.fromBytes(data, dict);
}

const lengthOf = (stream: PdfStream): number | undefined =>
  (stream.dict.get('/Length') as PdfNumber | undefined)?.value;

describe('compressPdfStream', () => {
  it('writes zlib data that node:zlib inflates back to the input', () => {
    const stream = streamOf(TEXT);
    compressPdfStream(stream, 6);
    expect(stream.dict.get('/Filter')).toBe(PdfName.of('FlateDecode'));
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(TEXT));
    expect(lengthOf(stream)).toBe(stream.data.length);
    expect([stream.data[0], stream.data[1]]).toEqual([0x78, 0x9c]);
  });

  it('honours the level in the zlib header', () => {
    const fast = streamOf(TEXT);
    const best = streamOf(TEXT);
    compressPdfStream(fast, 1);
    compressPdfStream(best, 9);
    expect(fast.data[0]).toBe(0x78);
    expect(best.data[1]).toBe(0xda);
    expect(new Uint8Array(inflateSync(fast.data))).toEqual(new Uint8Array(TEXT));
    expect(new Uint8Array(inflateSync(best.data))).toEqual(new Uint8Array(TEXT));
  });

  it('counts the zlib header and trailer when deciding whether compression pays', () => {
    // Find an input whose raw DEFLATE form is shorter, but whose zlib form is not.
    let input: Uint8Array | undefined;
    for (let n = 8; n < 400 && input === undefined; n++) {
      const candidate = encoder.encode('ab'.repeat(n).slice(0, n));
      const raw = fflateRaw(candidate, { level: 6 }).length;
      if (raw < candidate.length && raw + 6 >= candidate.length) input = candidate;
    }
    if (input === undefined) throw new Error('no break-even input found');
    const stream = streamOf(input);
    compressPdfStream(stream, 6);
    expect(stream.dict.has('/Filter')).toBe(false);
    expect(stream.data).toBe(input);
  });

  it('leaves a stream that already has a filter, and an empty stream, alone', () => {
    const filtered = streamOf(TEXT, PdfName.of('ASCIIHexDecode'));
    compressPdfStream(filtered, 6);
    expect(filtered.data).toBe(TEXT);
    expect(filtered.dict.get('/Filter')).toBe(PdfName.of('ASCIIHexDecode'));

    const empty = streamOf(new Uint8Array(0));
    compressPdfStream(empty, 6);
    expect(empty.dict.has('/Filter')).toBe(false);
  });

  it('writes zlib data with useWasm when the WASM module is not initialized', () => {
    const stream = streamOf(TEXT);
    compressPdfStream(stream, 6, true);
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(TEXT));
  });
});

describe('rewrapLegacyStream', () => {
  it('writes a raw DEFLATE /FlateDecode stream back as zlib data that node:zlib inflates', () => {
    const raw = new Uint8Array(deflateRawSync(TEXT));
    const stream = streamOf(raw, PdfName.of('FlateDecode'));
    rewrapLegacyStream(stream);
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(TEXT));
    expect(lengthOf(stream)).toBe(stream.data.length);
    expect(stream.dict.get('/Filter')).toBe(PdfName.of('FlateDecode'));
  });

  it('writes raw DEFLATE followed by an end-of-line back as zlib data that node:zlib inflates', () => {
    const raw = new Uint8Array(deflateRawSync(TEXT));
    const withEol = new Uint8Array(raw.length + 2);
    withEol.set(raw);
    withEol.set([0x0d, 0x0a], raw.length);
    const stream = streamOf(withEol, PdfName.of('FlateDecode'));
    rewrapLegacyStream(stream);
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(TEXT));
    expect(lengthOf(stream)).toBe(stream.data.length);
  });

  it('re-wraps when /FlateDecode is the first entry of a filter array', () => {
    const hex = encoder.encode([...TEXT].map((b) => b.toString(16).padStart(2, '0')).join(''));
    const raw = new Uint8Array(deflateRawSync(hex));
    const filters = PdfArray.of([PdfName.of('FlateDecode'), PdfName.of('ASCIIHexDecode')]);
    const stream = streamOf(raw, filters);
    rewrapLegacyStream(stream);
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(hex));
  });

  it('leaves a filter array whose first entry is not /FlateDecode alone', () => {
    const raw = new Uint8Array(deflateRawSync(TEXT));
    const filters = PdfArray.of([PdfName.of('ASCIIHexDecode'), PdfName.of('FlateDecode')]);
    const stream = streamOf(raw, filters);
    rewrapLegacyStream(stream);
    expect(stream.data).toBe(raw);
  });

  it('leaves zlib data, data that inflates neither way, and unfiltered data alone', () => {
    const zlib = new Uint8Array(zlibDeflateSync(TEXT));
    const wrapped = streamOf(zlib, PdfName.of('FlateDecode'));
    const before = wrapped.data;
    rewrapLegacyStream(wrapped);
    expect(wrapped.data).toBe(before);

    const garbage = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x13, 0x37]);
    const damaged = streamOf(garbage, PdfName.of('FlateDecode'));
    expect(() => rewrapLegacyStream(damaged)).not.toThrow();
    expect(damaged.data).toBe(garbage);

    const plain = streamOf(TEXT);
    rewrapLegacyStream(plain);
    expect(plain.data).toBe(TEXT);
  });

  it('keeps /DecodeParms as it is', () => {
    const raw = new Uint8Array(deflateRawSync(TEXT));
    const stream = streamOf(raw, PdfName.of('FlateDecode'));
    const parms = new PdfDict();
    parms.set('/Predictor', PdfNumber.of(12));
    stream.dict.set('/DecodeParms', parms);
    rewrapLegacyStream(stream);
    expect(stream.dict.get('/DecodeParms')).toBe(parms);
  });

  // Zero-filled buffers keep the raw DEFLATE data of the next two cases at about 64 KB.
  it('re-wraps a stream whose decoded data is just under 64 MiB', () => {
    expect(LEGACY_REWRAP_MAX_SIZE).toBe(64 * 1024 * 1024);
    const under = new Uint8Array(deflateRawSync(new Uint8Array(LEGACY_REWRAP_MAX_SIZE - 1)));
    const rewrapped = streamOf(under, PdfName.of('FlateDecode'));
    rewrapLegacyStream(rewrapped);
    expect([rewrapped.data[0], rewrapped.data[1]]).toEqual([0x78, 0x9c]);
    const plain = new Uint8Array(inflateSync(rewrapped.data));
    expect(plain.length).toBe(LEGACY_REWRAP_MAX_SIZE - 1);
    expect(plain.every((b) => b === 0)).toBe(true);
    expect(lengthOf(rewrapped)).toBe(rewrapped.data.length);
  });

  it('copies a stream whose decoded data is just over 64 MiB as loaded', () => {
    const over = new Uint8Array(deflateRawSync(new Uint8Array(LEGACY_REWRAP_MAX_SIZE + 1)));
    const copied = streamOf(over, PdfName.of('FlateDecode'));
    rewrapLegacyStream(copied);
    expect(copied.data).toBe(over);
    expect(lengthOf(copied)).toBe(over.length);
  });

  it('re-wraps a stream whose raw DEFLATE data is followed by 16 MiB of other bytes', () => {
    const raw = new Uint8Array(deflateRawSync(encoder.encode('hello world')));
    const data = new Uint8Array(raw.length + 16 * 1024 * 1024).fill(0x41);
    data.set(raw);
    const stream = streamOf(data, PdfName.of('FlateDecode'));
    const start = performance.now();
    rewrapLegacyStream(stream);
    const elapsed = performance.now() - start;
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(encoder.encode('hello world'));
    expect(elapsed).toBeLessThan(1000);
  });
});

/** 64 bytes from a fixed seed (mulberry32): not zlib data, yet they inflate as raw DEFLATE. */
function seededBytes(seed: number, length: number): Uint8Array {
  let state = seed >>> 0;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out[i] = (t ^ (t >>> 14)) & 0xff;
  }
  return out;
}

const OPAQUE = seededBytes(8, 64);

/** Where the trailer of {@link onePagePdf} has its /Encrypt entry, if it has one. */
type EncryptAt = 'none' | 'ref' | 'direct';

/**
 * A one-page PDF whose content stream is `/FlateDecode` with `data`. With `encrypt: 'ref'` the
 * trailer names an /Encrypt dictionary in object 5; with `encrypt: 'direct'` the same dictionary is
 * the trailer's /Encrypt value. `startxrefShift` moves the startxref offset off the `xref` keyword,
 * so the loader rebuilds the cross-reference table by scanning the file.
 */
function onePagePdf(
  data: Uint8Array,
  { encrypt, startxrefShift = 0 }: { encrypt: EncryptAt; startxrefShift?: number },
): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>',
    data,
  ];
  const pad = `<${'00'.repeat(32)}>`;
  const encryptDict = `<< /Filter /Standard /V 1 /R 2 /O ${pad} /U ${pad} /P -4 >>`;
  if (encrypt === 'ref') objects.push(encryptDict);
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  const push = (chunk: Uint8Array): void => {
    parts.push(chunk);
    offset += chunk.length;
  };
  push(encoder.encode('%PDF-1.7\n'));
  objects.forEach((body, i) => {
    offsets.push(offset);
    if (typeof body === 'string') {
      push(encoder.encode(`${i + 1} 0 obj\n${body}\nendobj\n`));
    } else {
      push(
        encoder.encode(
          `${i + 1} 0 obj\n<< /Length ${body.length} /Filter /FlateDecode >>\nstream\n`,
        ),
      );
      push(body);
      push(encoder.encode('\nendstream\nendobj\n'));
    }
  });
  const xrefAt = offset;
  const rows = offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  const id = `<${'ab'.repeat(16)}>`;
  const extra =
    encrypt === 'ref'
      ? ` /Encrypt 5 0 R /ID [${id} ${id}]`
      : encrypt === 'direct'
        ? ` /Encrypt ${encryptDict} /ID [${id} ${id}]`
        : '';
  push(
    encoder.encode(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${rows}` +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${extra} >>\n` +
        `startxref\n${xrefAt + startxrefShift}\n%%EOF\n`,
    ),
  );
  const file = new Uint8Array(offset);
  let at = 0;
  for (const part of parts) {
    file.set(part, at);
    at += part.length;
  }
  return file;
}

/** The data of every stream object `4 0` in a file written by the library. */
function contentStreams(bytes: Uint8Array): Uint8Array[] {
  const text = latin1.decode(bytes);
  const found: Uint8Array[] = [];
  for (const m of text.matchAll(/(?<![0-9])4 0 obj\n<<([^]*?)>>\nstream\n/g)) {
    const length = /\/Length (\d+)/.exec(m[1] ?? '')?.[1];
    if (length === undefined) throw new Error('object 4 without a direct /Length');
    const start = m.index + m[0].length;
    found.push(bytes.subarray(start, start + Number(length)));
  }
  return found;
}

/** The data of every stream object with a direct /Length, by object, and whether it has a /Filter. */
function streamsByObject(
  bytes: Uint8Array,
): Map<string, { filtered: boolean; data: Uint8Array[] }> {
  const text = latin1.decode(bytes);
  const found = new Map<string, { filtered: boolean; data: Uint8Array[] }>();
  for (const m of text.matchAll(/(?<!end)stream\r?\n/g)) {
    const start = m.index + m[0].length;
    const objAt = text.lastIndexOf(' obj', m.index);
    const header = text.slice(objAt, m.index);
    const length = /\/Length (\d+)/.exec(header)?.[1];
    const object = /(\d+ \d+)$/.exec(text.slice(Math.max(0, objAt - 16), objAt))?.[1];
    if (length === undefined || object === undefined)
      throw new Error('stream without a direct /Length');
    const entry = found.get(object) ?? { filtered: header.includes('/Filter'), data: [] };
    entry.data.push(bytes.subarray(start, start + Number(length)));
    found.set(object, entry);
  }
  return found;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('save() of a document loaded from a file whose trailer has /Encrypt', () => {
  it('starts from data that is not zlib data and that node:zlib inflates as raw DEFLATE', () => {
    // A zlib header's first byte names method 8 in its low four bits.
    expect((OPAQUE[0] ?? 0) & 0x0f).not.toBe(8);
    expect(() => inflateRawSync(OPAQUE)).not.toThrow();
  });

  it.each([true, false])(
    'writes such /FlateDecode data byte for byte as loaded (compress: %s)',
    async (compress) => {
      const doc = await loadPdf(onePagePdf(OPAQUE, { encrypt: 'ref' }), {
        ignoreEncryption: true,
      });
      const saved = contentStreams(await doc.save({ compress }));
      expect(saved.length).toBeGreaterThan(0);
      for (const data of saved) expect(new Uint8Array(data)).toEqual(OPAQUE);

      const again = await loadPdf(onePagePdf(OPAQUE, { encrypt: 'ref' }), {
        ignoreEncryption: true,
      });
      const streamed = contentStreams(await readAll(again.saveAsStream({ compress })));
      expect(streamed.length).toBeGreaterThan(0);
      for (const data of streamed) expect(new Uint8Array(data)).toEqual(OPAQUE);
    },
  );

  // An indirect /Encrypt in a file whose cross-reference table is rebuilt by a scan, and a direct
  // /Encrypt dictionary in the trailer.
  const variants: { encrypt: EncryptAt; startxrefShift?: number }[] = [
    { encrypt: 'ref', startxrefShift: 3 },
    { encrypt: 'direct' },
  ];
  const loads = [{ ignoreEncryption: true }, { password: '' }, {}];
  const variantCases = variants.flatMap((file) =>
    loads.flatMap((load) => [true, false].map((compress) => ({ file, load, compress }))),
  );

  it.each(variantCases)(
    'writes such /FlateDecode data byte for byte as loaded ($file, loaded with $load, compress: $compress)',
    async ({ file, load, compress }) => {
      const doc = await loadPdf(onePagePdf(OPAQUE, file), load);
      const saved = contentStreams(await doc.save({ compress }));
      expect(saved.length).toBeGreaterThan(0);
      for (const data of saved) expect(new Uint8Array(data)).toEqual(OPAQUE);

      const again = await loadPdf(onePagePdf(OPAQUE, file), load);
      const streamed = contentStreams(await readAll(again.saveAsStream({ compress })));
      expect(streamed.length).toBeGreaterThan(0);
      for (const data of streamed) expect(new Uint8Array(data)).toEqual(OPAQUE);
    },
  );

  // Files written by qpdf: the expectation is each stream's data as it is in the input file.
  const FILES = [
    { file: '../../fixtures/encrypted/aes-128-r4.pdf', password: 'user' },
    { file: '../../fixtures/corpus/qpdf-r4-rc4.pdf', password: '' },
  ];
  const cases = FILES.flatMap(({ file, password }) =>
    [{ password }, { ignoreEncryption: true }].flatMap((load) => [
      { file, load, compress: true },
      { file, load, compress: false },
    ]),
  );

  it.each(cases)(
    '$file loaded with $load and saved with compress: $compress keeps the stream data of the file',
    async ({ file, load, compress }) => {
      const input = new Uint8Array(readFileSync(join(import.meta.dirname, file)));
      const before = streamsByObject(input);
      const doc = await loadPdf(input, load);
      const after = streamsByObject(await doc.save({ compress }));

      // Default compression still compresses a stream that has no /Filter.
      const kept = [...before].filter(([, s]) => !compress || s.filtered);
      expect(kept.length).toBeGreaterThan(0);
      for (const [object, s] of kept) {
        const expected = s.data.at(-1);
        const written = after.get(object)?.data ?? [];
        expect(written.length, `object ${object} in the output`).toBeGreaterThan(0);
        for (const data of written)
          expect(data, `stream data of object ${object}`).toEqual(expected);
      }
    },
  );

  it('re-wraps the same data as zlib data when the file has no /Encrypt', async () => {
    const doc = await loadPdf(onePagePdf(OPAQUE, { encrypt: 'none' }));
    const saved = contentStreams(await doc.save());
    expect(saved.length).toBeGreaterThan(0);
    for (const data of saved) {
      expect(new Uint8Array(inflateSync(data))).toEqual(new Uint8Array(inflateRawSync(OPAQUE)));
    }
  });
});
