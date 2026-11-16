/**
 * Tests for the stream compression shared by the PDF writers.
 *
 * Every /FlateDecode result is judged by node:zlib `inflateSync`, which checks the zlib header
 * and the Adler-32 trailer. A document loaded with `ignoreEncryption` from a file whose trailer
 * has /Encrypt keeps its /FlateDecode data on save: the tests build such a file around data from
 * a fixed seed that node:zlib `inflateRawSync` accepts, with the /Encrypt entry indirect or
 * direct and with a cross-reference table the loader rebuilds by a scan, and a control file
 * without /Encrypt. Without `ignoreEncryption` a direct or recovered /Encrypt throws on load.
 * Two encrypted files written by qpdf, loaded with `ignoreEncryption`, keep the stream data of
 * the input file; loaded with their password they refuse save until `encrypt()` is called.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  constants,
  deflateRawSync,
  deflateSync as zlibDeflateSync,
  inflateRawSync,
  inflateSync,
} from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { Inflate, deflateSync as fflateRaw } from 'fflate';
import {
  compressPdfStream,
  rewrapLegacyStream,
  rewriteSyncFlushedStream,
} from '../../../../src/core/internal/flateStream.js';
import { UnsupportedEncryptionError } from '../../../../src/errors.js';
import { INTERNAL_LIMITS, beginCall, resolveLimits } from '../../../../src/internal/limits.js';
import { DEFAULT_LIMITS } from '../../../../src/limits.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
} from '../../../../src/core/pdfObjects.js';
import { loadPdf } from '../../../../src/index.js';

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
    rewrapLegacyStream(stream, beginCall(DEFAULT_LIMITS));
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
    rewrapLegacyStream(stream, beginCall(DEFAULT_LIMITS));
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(TEXT));
    expect(lengthOf(stream)).toBe(stream.data.length);
  });

  it('re-wraps when /FlateDecode is the first entry of a filter array', () => {
    const hex = encoder.encode([...TEXT].map((b) => b.toString(16).padStart(2, '0')).join(''));
    const raw = new Uint8Array(deflateRawSync(hex));
    const filters = PdfArray.of([PdfName.of('FlateDecode'), PdfName.of('ASCIIHexDecode')]);
    const stream = streamOf(raw, filters);
    rewrapLegacyStream(stream, beginCall(DEFAULT_LIMITS));
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(hex));
  });

  it('leaves a filter array whose first entry is not /FlateDecode alone', () => {
    const raw = new Uint8Array(deflateRawSync(TEXT));
    const filters = PdfArray.of([PdfName.of('ASCIIHexDecode'), PdfName.of('FlateDecode')]);
    const stream = streamOf(raw, filters);
    rewrapLegacyStream(stream, beginCall(DEFAULT_LIMITS));
    expect(stream.data).toBe(raw);
  });

  it('leaves zlib data, data that inflates neither way, and unfiltered data alone', () => {
    const zlib = new Uint8Array(zlibDeflateSync(TEXT));
    const wrapped = streamOf(zlib, PdfName.of('FlateDecode'));
    const before = wrapped.data;
    rewrapLegacyStream(wrapped, beginCall(DEFAULT_LIMITS));
    expect(wrapped.data).toBe(before);

    const garbage = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x00, 0x13, 0x37]);
    const damaged = streamOf(garbage, PdfName.of('FlateDecode'));
    expect(() => rewrapLegacyStream(damaged, beginCall(DEFAULT_LIMITS))).not.toThrow();
    expect(damaged.data).toBe(garbage);

    const plain = streamOf(TEXT);
    rewrapLegacyStream(plain, beginCall(DEFAULT_LIMITS));
    expect(plain.data).toBe(TEXT);
  });

  it('keeps /DecodeParms as it is', () => {
    const raw = new Uint8Array(deflateRawSync(TEXT));
    const stream = streamOf(raw, PdfName.of('FlateDecode'));
    const parms = new PdfDict();
    parms.set('/Predictor', PdfNumber.of(12));
    stream.dict.set('/DecodeParms', parms);
    rewrapLegacyStream(stream, beginCall(DEFAULT_LIMITS));
    expect(stream.dict.get('/DecodeParms')).toBe(parms);
  });

  // Zero-filled buffers keep the raw DEFLATE data of the next two cases at about 64 KB.
  it('re-wraps a stream whose decoded data is just under 64 MiB', () => {
    expect(INTERNAL_LIMITS.maxRewrapDecodedBytes).toBe(64 * 1024 * 1024);
    const under = new Uint8Array(
      deflateRawSync(new Uint8Array(INTERNAL_LIMITS.maxRewrapDecodedBytes - 1)),
    );
    const rewrapped = streamOf(under, PdfName.of('FlateDecode'));
    rewrapLegacyStream(rewrapped, beginCall(DEFAULT_LIMITS));
    expect([rewrapped.data[0], rewrapped.data[1]]).toEqual([0x78, 0x9c]);
    const plain = new Uint8Array(inflateSync(rewrapped.data));
    expect(plain.length).toBe(INTERNAL_LIMITS.maxRewrapDecodedBytes - 1);
    expect(plain.every((b) => b === 0)).toBe(true);
    expect(lengthOf(rewrapped)).toBe(rewrapped.data.length);
  });

  it('copies a stream whose decoded data is just over 64 MiB as loaded', () => {
    const over = new Uint8Array(
      deflateRawSync(new Uint8Array(INTERNAL_LIMITS.maxRewrapDecodedBytes + 1)),
    );
    const copied = streamOf(over, PdfName.of('FlateDecode'));
    rewrapLegacyStream(copied, beginCall(DEFAULT_LIMITS));
    expect(copied.data).toBe(over);
    expect(lengthOf(copied)).toBe(over.length);
  });

  it('re-wraps a stream whose raw DEFLATE data is followed by 16 MiB of other bytes', () => {
    const raw = new Uint8Array(deflateRawSync(encoder.encode('hello world')));
    const data = new Uint8Array(raw.length + 16 * 1024 * 1024).fill(0x41);
    data.set(raw);
    const stream = streamOf(data, PdfName.of('FlateDecode'));
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      rewrapLegacyStream(stream, beginCall(DEFAULT_LIMITS));
      // The read stops on its idle-step rule: the step that decodes "hello world", eight steps
      // that decode nothing and the one byte that ends the input, not the 16 MiB (1,025 steps).
      expect(push.mock.calls.length).toBeLessThanOrEqual(10);
      const pushed = push.mock.calls.reduce((sum, [chunk]) => sum + chunk.length, 0);
      expect(pushed).toBeLessThan(1024 * 1024);
    } finally {
      push.mockRestore();
    }
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(encoder.encode('hello world'));
  });

  it('decodes under the maxDecodedStreamBytes of the context when it is below 64 MiB', () => {
    const ctx = beginCall(resolveLimits({ maxDecodedStreamBytes: 1024 }));
    const at = streamOf(
      new Uint8Array(deflateRawSync(new Uint8Array(1024))),
      PdfName.of('FlateDecode'),
    );
    rewrapLegacyStream(at, ctx);
    expect(new Uint8Array(inflateSync(at.data))).toEqual(new Uint8Array(1024));
    const data = new Uint8Array(deflateRawSync(new Uint8Array(1025)));
    const over = streamOf(data, PdfName.of('FlateDecode'));
    rewrapLegacyStream(over, ctx);
    expect(over.data).toBe(data);
    rewrapLegacyStream(over, beginCall(DEFAULT_LIMITS));
    expect(new Uint8Array(inflateSync(over.data))).toEqual(new Uint8Array(1025));
  });
});

/** Zlib data that ends at a sync flush: no final DEFLATE block and no Adler-32 trailer. */
const syncFlushed = (data: Uint8Array): Uint8Array =>
  new Uint8Array(zlibDeflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH }));

/** node:zlib's reading of data cut short: the bytes decoded up to the end of the input. */
const decodedSoFar = (data: Uint8Array): Uint8Array =>
  new Uint8Array(inflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH }));

/**
 * Zlib data of `mib` MiB of zeros followed by `extra` zero bytes that ends at a sync flush: the
 * zlib header, then the sync-flushed raw DEFLATE of one MiB of zeros `mib` times (each piece
 * refers back only into its own output), then that of `extra` zeros.
 */
function syncFlushedZeros(mib: number, extra: number): { data: Uint8Array; piece: number } {
  const flush = { finishFlush: constants.Z_SYNC_FLUSH };
  const piece = new Uint8Array(deflateRawSync(new Uint8Array(1024 * 1024), flush));
  const last = new Uint8Array(deflateRawSync(new Uint8Array(extra), flush));
  const data = new Uint8Array(2 + mib * piece.length + last.length);
  data.set([0x78, 0x9c]);
  for (let i = 0; i < mib; i++) data.set(piece, 2 + i * piece.length);
  data.set(last, 2 + mib * piece.length);
  return { data, piece: piece.length };
}

describe('rewriteSyncFlushedStream', () => {
  it('writes zlib data that ends at a sync flush back as zlib data that node:zlib inflates', () => {
    const data = syncFlushed(TEXT);
    expect(() => inflateSync(data)).toThrow('unexpected end of file');
    const stream = streamOf(data, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(stream, beginCall(DEFAULT_LIMITS));
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(TEXT));
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(decodedSoFar(data));
    expect(lengthOf(stream)).toBe(stream.data.length);
    expect(stream.dict.get('/Filter')).toBe(PdfName.of('FlateDecode'));
  });

  it('rewrites when /FlateDecode is the first entry of a filter array, and keeps /DecodeParms', () => {
    const data = syncFlushed(TEXT);
    const filters = PdfArray.of([PdfName.of('FlateDecode'), PdfName.of('ASCIIHexDecode')]);
    const stream = streamOf(data, filters);
    const parms = new PdfDict();
    parms.set('/Predictor', PdfNumber.of(12));
    stream.dict.set('/DecodeParms', parms);
    rewriteSyncFlushedStream(stream, beginCall(DEFAULT_LIMITS));
    expect(new Uint8Array(inflateSync(stream.data))).toEqual(new Uint8Array(TEXT));
    expect(stream.dict.get('/DecodeParms')).toBe(parms);
    expect(stream.dict.get('/Filter')).toBe(filters);
  });

  it('never rewrites complete zlib data', () => {
    const complete = new Uint8Array(zlibDeflateSync(TEXT));
    const stream = streamOf(complete, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(stream, beginCall(DEFAULT_LIMITS));
    expect(stream.data).toBe(complete);
    // Complete data followed by the bytes a sync flush ends with.
    const trailing = new Uint8Array([...complete, 0x00, 0x00, 0xff, 0xff]);
    const after = streamOf(trailing, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(after, beginCall(DEFAULT_LIMITS));
    expect(after.data).toBe(trailing);
  });

  it('leaves data that is damaged in another way, raw DEFLATE and other filters alone', () => {
    const data = syncFlushed(TEXT);
    const cut = data.subarray(0, data.length - 7);
    const cutShort = streamOf(cut, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(cutShort, beginCall(DEFAULT_LIMITS));
    expect(cutShort.data).toBe(cut);

    const invalid = new Uint8Array([...data, 0x07, 0xff, 0x00, 0x00, 0x00, 0xff, 0xff]);
    const damaged = streamOf(invalid, PdfName.of('FlateDecode'));
    expect(() => rewriteSyncFlushedStream(damaged, beginCall(DEFAULT_LIMITS))).not.toThrow();
    expect(damaged.data).toBe(invalid);

    const raw = new Uint8Array(deflateRawSync(TEXT, { finishFlush: constants.Z_SYNC_FLUSH }));
    const legacy = streamOf(raw, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(legacy, beginCall(DEFAULT_LIMITS));
    expect(legacy.data).toBe(raw);

    const second = streamOf(
      data,
      PdfArray.of([PdfName.of('ASCIIHexDecode'), PdfName.of('FlateDecode')]),
    );
    rewriteSyncFlushedStream(second, beginCall(DEFAULT_LIMITS));
    expect(second.data).toBe(data);

    const unfiltered = streamOf(data);
    rewriteSyncFlushedStream(unfiltered, beginCall(DEFAULT_LIMITS));
    expect(unfiltered.data).toBe(data);
  });

  // The pieces of zeros keep these inputs at about 1 KB per MiB decoded.
  it('rewrites a stream whose decoded data is exactly 64 MiB', () => {
    expect(INTERNAL_LIMITS.maxRewrapDecodedBytes).toBe(64 * 1024 * 1024);
    const { data } = syncFlushedZeros(64, 0);
    const stream = streamOf(data, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(stream, beginCall(DEFAULT_LIMITS));
    const plain = new Uint8Array(inflateSync(stream.data));
    expect(plain.length).toBe(INTERNAL_LIMITS.maxRewrapDecodedBytes);
    expect(plain.every((b) => b === 0)).toBe(true);
    expect(lengthOf(stream)).toBe(stream.data.length);
  });

  it('copies a stream whose decoded data is just over 64 MiB as loaded', () => {
    const { data } = syncFlushedZeros(64, 1);
    const stream = streamOf(data, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(stream, beginCall(DEFAULT_LIMITS));
    expect(stream.data).toBe(data);
    expect(lengthOf(stream)).toBe(data.length);
  });

  it('decodes under the maxDecodedStreamBytes of the context when it is below 64 MiB', () => {
    const ctx = beginCall(resolveLimits({ maxDecodedStreamBytes: 1024 }));
    const at = streamOf(syncFlushed(new Uint8Array(1024)), PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(at, ctx);
    expect(new Uint8Array(inflateSync(at.data))).toEqual(new Uint8Array(1024));
    const data = syncFlushed(new Uint8Array(1025));
    const over = streamOf(data, PdfName.of('FlateDecode'));
    rewriteSyncFlushedStream(over, ctx);
    expect(over.data).toBe(data);
    rewriteSyncFlushedStream(over, beginCall(DEFAULT_LIMITS));
    expect(new Uint8Array(inflateSync(over.data))).toEqual(new Uint8Array(1025));
  });

  it('reads no input after the step that takes the decoded size past 64 MiB', () => {
    // 1 GiB of zeros once decoded: about 1 MB of input.
    const { data, piece } = syncFlushedZeros(1024, 0);
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      const stream = streamOf(data, PdfName.of('FlateDecode'));
      rewriteSyncFlushedStream(stream, beginCall(DEFAULT_LIMITS));
      expect(stream.data).toBe(data);
      const read = push.mock.calls.reduce((sum, [chunk]) => sum + chunk.length, 0);
      // 64 pieces decode to the limit; reading stops after the 16 KiB step that goes past it.
      expect(read).toBeLessThanOrEqual(64 * piece + 2 * 16 * 1024);
      expect(read).toBeLessThan(data.length / 8);
    } finally {
      push.mockRestore();
    }
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
  const variantCases = variants.flatMap((file) =>
    [true, false].map((compress) => ({ file, compress })),
  );

  it.each(variantCases)(
    'writes such /FlateDecode data byte for byte as loaded with ignoreEncryption ($file, compress: $compress)',
    async ({ file, compress }) => {
      const load = { ignoreEncryption: true };
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

  // A direct or recovered /Encrypt cannot be honoured: the load throws unless the caller opts out.
  const refusedLoads = variants.flatMap((file) =>
    [{ password: '' }, {}].map((load) => ({ file, load })),
  );

  it.each(refusedLoads)(
    'refuses to load such a file instead of keeping its data ($file, loaded with $load)',
    async ({ file, load }) => {
      await expect(loadPdf(onePagePdf(OPAQUE, file), load)).rejects.toThrow(
        UnsupportedEncryptionError,
      );
    },
  );

  // Files written by qpdf: with ignoreEncryption the expectation is each stream's data as it is in
  // the input file.
  const FILES = [
    { file: '../../../fixtures/encrypted/aes-128-r4.pdf', password: 'user' },
    { file: '../../../fixtures/corpus/qpdf-r4-rc4.pdf', password: '' },
  ];
  const cases = FILES.flatMap(({ file }) => [true, false].map((compress) => ({ file, compress })));

  it.each(cases)(
    '$file loaded with ignoreEncryption and saved with compress: $compress keeps the stream data of the file',
    async ({ file, compress }) => {
      const input = new Uint8Array(readFileSync(join(import.meta.dirname, file)));
      const before = streamsByObject(input);
      const doc = await loadPdf(input, { ignoreEncryption: true });
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

  // Loaded with the password, the objects are plaintext: no save writes them without encryption.
  const decryptedCases = FILES.flatMap(({ file, password }) =>
    [true, false].map((compress) => ({ file, password, compress })),
  );

  it.each(decryptedCases)(
    '$file loaded with its password refuses save() and saveAsStream() until encrypt() is called (compress: $compress)',
    async ({ file, password, compress }) => {
      const input = new Uint8Array(readFileSync(join(import.meta.dirname, file)));
      const doc = await loadPdf(input, { password });
      await expect(doc.save({ compress })).rejects.toThrow(UnsupportedEncryptionError);
      expect(() => doc.saveAsStream({ compress })).toThrow(UnsupportedEncryptionError);

      await doc.encrypt({ userPassword: 'new-user', ownerPassword: 'new-owner' });
      const written = await doc.save({ compress });
      expect(latin1.decode(written)).toContain('/Encrypt');
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

describe('the writers on a loaded stream whose zlib data ends at a sync flush', () => {
  const CUT = syncFlushed(TEXT);

  it.each([true, false])(
    'save() and saveAsStream() write the same complete zlib data (compress: %s)',
    async (compress) => {
      const saved = contentStreams(
        await (await loadPdf(onePagePdf(CUT, { encrypt: 'none' }))).save({ compress }),
      );
      const streamed = contentStreams(
        await readAll(
          (await loadPdf(onePagePdf(CUT, { encrypt: 'none' }))).saveAsStream({ compress }),
        ),
      );
      expect(saved.length).toBeGreaterThan(0);
      for (const data of saved) {
        expect(new Uint8Array(inflateSync(data))).toEqual(new Uint8Array(TEXT));
      }
      expect(streamed).toEqual(saved);
    },
  );

  it.each([true, false])(
    'writes such data byte for byte as loaded with ignoreEncryption from a file with /Encrypt (compress: %s)',
    async (compress) => {
      const load = { ignoreEncryption: true };
      const doc = await loadPdf(onePagePdf(CUT, { encrypt: 'ref' }), load);
      const saved = contentStreams(await doc.save({ compress }));
      expect(saved.length).toBeGreaterThan(0);
      for (const data of saved) expect(new Uint8Array(data)).toEqual(CUT);

      const again = await loadPdf(onePagePdf(CUT, { encrypt: 'ref' }), load);
      const streamed = contentStreams(await readAll(again.saveAsStream({ compress })));
      expect(streamed.length).toBeGreaterThan(0);
      for (const data of streamed) expect(new Uint8Array(data)).toEqual(CUT);
    },
  );

  it('writes the three such streams of a corpus file as node:zlib decodes them', async () => {
    const input = new Uint8Array(
      readFileSync(join(import.meta.dirname, '../../../fixtures/corpus/qpdf-form-acrobat.pdf')),
    );
    const text = latin1.decode(input);
    const saved = streamsByObject(await (await loadPdf(input)).save());
    for (const [object, size] of [
      ['83 0', 142],
      ['84 0', 46],
      ['85 0', 194_634],
    ] as const) {
      const at = text.indexOf(`\n${object} obj`);
      const head = /\/Length (\d+)[^]*?stream\r?\n/.exec(text.slice(at));
      if (head === null) throw new Error(`object ${object} not found`);
      const start = at + head.index + head[0].length;
      const loaded = input.subarray(start, start + Number(head[1]));
      expect(() => inflateSync(loaded), `object ${object} of the input`).toThrow();
      const written = saved.get(object)?.data ?? [];
      expect(written.length, `object ${object} in the output`).toBeGreaterThan(0);
      for (const data of written) {
        const plain = new Uint8Array(inflateSync(data));
        expect(plain.length).toBe(size);
        expect(plain).toEqual(decodedSoFar(loaded));
      }
    }
  });
});
