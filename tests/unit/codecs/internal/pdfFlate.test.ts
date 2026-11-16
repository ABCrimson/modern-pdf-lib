/**
 * Tests for the FlateDecode codec (src/codecs/internal/pdfFlate.ts).
 *
 * node:zlib is the oracle: its `inflateSync` checks the RFC 1950 header and
 * the Adler-32 trailer, so output it accepts is zlib data as ISO 32000
 * requires under /FlateDecode. Inputs for the decoder are built with
 * node:zlib too (`deflateSync` for zlib, `deflateRawSync` for raw DEFLATE,
 * `gzipSync` for gzip), never with the codec under test.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  constants,
  deflateRawSync,
  deflateSync,
  gzipSync,
  inflateRawSync,
  inflateSync,
} from 'node:zlib';
import { Inflate } from 'fflate';
import {
  adler32,
  flateEncode,
  inflateFlate,
  inflateFlateUpTo,
  inflateRaw,
  inflateRawBounded,
  inflateSyncFlushedZlib,
  isZlibHeader,
  wrapRawDeflate,
} from '../../../../src/codecs/internal/pdfFlate.js';
import { INTERNAL_LIMITS } from '../../../../src/internal/limits.js';
import { ResourceLimitError } from '../../../../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Copy any byte view (Buffer included) into a plain Uint8Array. */
function bytes(view: Uint8Array): Uint8Array {
  return Uint8Array.from(view);
}

/**
 * Assert that a read of `inputLength` bytes, whose DEFLATE data ends in its first step, stopped on
 * the idle-step rule: the step that decodes the data, eight steps that decode nothing and the one
 * byte that ends the input are 10 pushes, and far fewer bytes than the input holds.
 */
function expectReadStopsEarly(
  push: { readonly mock: { readonly calls: readonly (readonly [Uint8Array, ...unknown[]])[] } },
  inputLength: number,
): void {
  expect(push.mock.calls.length).toBeLessThanOrEqual(10);
  const pushed = push.mock.calls.reduce((sum, [chunk]) => sum + chunk.length, 0);
  expect(pushed).toBeLessThan(inputLength / 16);
}

/** A content stream of the size and shape a page usually carries. */
function contentStream(lines: number): Uint8Array {
  let text = '';
  for (let i = 0; i < lines; i++) {
    text += `BT /F1 12 Tf 72 ${720 - i * 14} Td (Line ${i} of the sample page) Tj ET\n`;
  }
  return encoder.encode(text);
}

/** Bytes 0..255 repeated: compressible, and every byte value occurs. */
function byteRamp(size: number): Uint8Array {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) data[i] = i % 256;
  return data;
}

const SAMPLE = contentStream(150);
const FAILURE = /^FlateDecode: failed to decompress data$/;

/** Header bytes fflate writes per level (FLEVEL 1 for 1-5, 2 for 6-8, 3 for 9). */
const HEADER_BY_LEVEL: Record<number, [number, number]> = {
  1: [0x78, 0x5e],
  2: [0x78, 0x5e],
  3: [0x78, 0x5e],
  4: [0x78, 0x5e],
  5: [0x78, 0x5e],
  6: [0x78, 0x9c],
  7: [0x78, 0x9c],
  8: [0x78, 0x9c],
  9: [0x78, 0xda],
};

// ---------------------------------------------------------------------------
// flateEncode
// ---------------------------------------------------------------------------

describe('flateEncode', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'writes zlib data that node:zlib inflates at level %i',
    (level) => {
      const encoded = flateEncode(SAMPLE, level);
      expect(bytes(inflateSync(encoded))).toEqual(SAMPLE);
      expect([encoded[0], encoded[1]]).toEqual(HEADER_BY_LEVEL[level]);
    },
  );

  it('defaults to level 6', () => {
    const encoded = flateEncode(SAMPLE);
    expect(encoded).toEqual(flateEncode(SAMPLE, 6));
    expect([encoded[0], encoded[1]]).toEqual([0x78, 0x9c]);
  });

  it('rounds and clamps the level to 1..9', () => {
    expect(flateEncode(SAMPLE, 0)).toEqual(flateEncode(SAMPLE, 1));
    expect(flateEncode(SAMPLE, -3)).toEqual(flateEncode(SAMPLE, 1));
    expect(flateEncode(SAMPLE, 12)).toEqual(flateEncode(SAMPLE, 9));
    expect(flateEncode(SAMPLE, 6.4)).toEqual(flateEncode(SAMPLE, 6));
  });

  it('writes zlib data for empty input', () => {
    const encoded = flateEncode(new Uint8Array(0));
    expect(bytes(inflateSync(encoded)).length).toBe(0);
  });

  it('writes zlib data for input that does not compress', () => {
    const data = byteRamp(256);
    expect(bytes(inflateSync(flateEncode(data)))).toEqual(data);
  });

  it('round-trips through inflateFlate at every level', () => {
    for (let level = 1; level <= 9; level++) {
      expect(inflateFlate(flateEncode(SAMPLE, level))).toEqual(SAMPLE);
    }
  });
});

// ---------------------------------------------------------------------------
// inflateFlate
// ---------------------------------------------------------------------------

describe('inflateFlate', () => {
  it('inflates zlib data', () => {
    expect(inflateFlate(deflateSync(SAMPLE))).toEqual(SAMPLE);
  });

  it('inflates zlib data at every node:zlib level', () => {
    for (let level = 0; level <= 9; level++) {
      expect(inflateFlate(deflateSync(SAMPLE, { level }))).toEqual(SAMPLE);
    }
  });

  it('inflates zlib data whose Adler-32 trailer is missing', () => {
    const zlib = bytes(deflateSync(SAMPLE));
    expect(inflateFlate(zlib.subarray(0, zlib.length - 4))).toEqual(SAMPLE);
  });

  it('inflates zlib data whose Adler-32 trailer is cut short', () => {
    const zlib = bytes(deflateSync(SAMPLE));
    expect(inflateFlate(zlib.subarray(0, zlib.length - 2))).toEqual(SAMPLE);
  });

  it('inflates zlib data whose Adler-32 trailer is wrong', () => {
    const zlib = bytes(deflateSync(SAMPLE));
    const last = zlib.length - 1;
    zlib[last] = (zlib[last] ?? 0) ^ 0xff;
    expect(() => inflateSync(zlib)).toThrow(/incorrect data check/);
    expect(inflateFlate(zlib)).toEqual(SAMPLE);
  });

  it('inflates zlib data followed by an end-of-line before endstream', () => {
    const zlib = bytes(deflateSync(SAMPLE));
    const withEol = new Uint8Array(zlib.length + 2);
    withEol.set(zlib);
    withEol.set([0x0d, 0x0a], zlib.length);
    expect(inflateFlate(withEol)).toEqual(SAMPLE);
  });

  it('inflates raw DEFLATE data (files written by earlier versions)', () => {
    expect(inflateFlate(deflateRawSync(SAMPLE))).toEqual(SAMPLE);
  });

  it('inflates raw DEFLATE data at every node:zlib level', () => {
    for (let level = 0; level <= 9; level++) {
      expect(inflateFlate(deflateRawSync(SAMPLE, { level }))).toEqual(SAMPLE);
    }
  });

  it('reads raw DEFLATE whose first two bytes form a zlib header as zlib data', () => {
    // A non-final stored block whose padding bits are not zero (first byte 0x08) and whose
    // LEN is 859 (5b 03) starts with the bytes 08 5b, a valid zlib header; then a final block.
    const payload = new Uint8Array(859).map((_, i) => (i * 7) & 0xff);
    const tail = encoder.encode('final block\n');
    const finalBlock = bytes(deflateRawSync(tail));
    const raw = new Uint8Array(5 + payload.length + finalBlock.length);
    raw.set([0x08, 0x5b, 0x03, 0xa4, 0xfc]);
    raw.set(payload, 5);
    raw.set(finalBlock, 5 + payload.length);

    const expected = new Uint8Array(payload.length + tail.length);
    expected.set(payload);
    expected.set(tail, payload.length);
    expect(bytes(inflateRawSync(raw))).toEqual(expected);

    expect(isZlibHeader(raw)).toBe(true);
    expect(inflateFlate(raw).length).toBe(0);
  });

  it('inflates zlib data of empty input to empty output', () => {
    expect(inflateFlate(deflateSync(new Uint8Array(0))).length).toBe(0);
  });

  it('returns empty output for empty input', () => {
    expect(inflateFlate(new Uint8Array(0)).length).toBe(0);
  });

  it('rejects gzip data with the FlateDecode error', () => {
    const gzip = bytes(gzipSync(SAMPLE));
    expect(() => inflateFlate(gzip)).toThrow(FAILURE);
  });

  it('rejects plain text with the FlateDecode error', () => {
    const text = encoder.encode('plain text, never compressed\n');
    expect(() => inflateFlate(text)).toThrow(FAILURE);
  });

  it('throws a plain Error', () => {
    let caught: unknown;
    try {
      inflateFlate(encoder.encode('plain text, never compressed\n'));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).toBe('Error');
    expect((caught as Error).message).toBe('FlateDecode: failed to decompress data');
  });
});

// ---------------------------------------------------------------------------
// inflateRaw
// ---------------------------------------------------------------------------

describe('inflateRaw', () => {
  it('equals node:zlib inflateRawSync for raw DEFLATE data', () => {
    const raw = bytes(deflateRawSync(SAMPLE));
    expect(inflateRaw(raw)).toEqual(bytes(inflateRawSync(raw)));
  });

  it('throws the FlateDecode error for zlib data', () => {
    expect(() => inflateRaw(bytes(deflateSync(SAMPLE)))).toThrow(FAILURE);
  });

  it('throws the FlateDecode error for plain text', () => {
    expect(() => inflateRaw(encoder.encode('plain text, never compressed\n'))).toThrow(FAILURE);
  });
});

// ---------------------------------------------------------------------------
// inflateRawBounded
// ---------------------------------------------------------------------------

describe('inflateRawBounded', () => {
  /** About 700 KB of page content: its raw DEFLATE spans several 16 KiB input steps. */
  const LONG = contentStream(12_000);
  const LONG_RAW = bytes(deflateRawSync(LONG));

  it('reads input that spans several 16 KiB steps', () => {
    expect(LONG_RAW.length).toBeGreaterThan(3 * 16 * 1024);
  });

  it('equals node:zlib inflateRawSync when the decoded size is under the bound', () => {
    expect(inflateRawBounded(LONG_RAW, LONG.length + 1)).toEqual(bytes(inflateRawSync(LONG_RAW)));
    const small = bytes(deflateRawSync(SAMPLE));
    expect(inflateRawBounded(small, 1 << 20)).toEqual(bytes(inflateRawSync(small)));
  });

  it('returns the data when the decoded size equals the bound', () => {
    expect(inflateRawBounded(LONG_RAW, LONG.length)).toEqual(new Uint8Array(LONG));
  });

  it('returns undefined when the decoded size is over the bound', () => {
    expect(inflateRawBounded(LONG_RAW, LONG.length - 1)).toBeUndefined();
    expect(inflateRawBounded(LONG_RAW, 1000)).toBeUndefined();
  });

  it('stops after the input step that takes the decoded size past the bound', () => {
    // 32 MiB of zeros: about 32 KB of raw DEFLATE, whose first 16 KiB step decodes to more
    // than 1 MiB.
    const zeros = bytes(deflateRawSync(new Uint8Array(32 * 1024 * 1024)));
    expect(zeros.length).toBeGreaterThan(16 * 1024);
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      expect(inflateRawBounded(zeros, 1024 * 1024)).toBeUndefined();
      expect(push).toHaveBeenCalledTimes(1);
    } finally {
      push.mockRestore();
    }
  });

  it('ignores bytes after the final block', () => {
    const raw = bytes(deflateRawSync(SAMPLE));
    const withEol = new Uint8Array(raw.length + 2);
    withEol.set(raw);
    withEol.set([0x0d, 0x0a], raw.length);
    expect(inflateRawBounded(withEol, 1 << 20)).toEqual(bytes(inflateRawSync(raw)));
  });

  it('reads raw DEFLATE data followed by 16 MiB of other bytes without reading the 16 MiB', () => {
    const raw = bytes(deflateRawSync(encoder.encode('hello world')));
    const data = new Uint8Array(raw.length + 16 * 1024 * 1024).fill(0x41);
    data.set(raw);
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      expect(inflateRawBounded(data, 64 * 1024 * 1024)).toEqual(encoder.encode('hello world'));
      expectReadStopsEarly(push, data.length);
    } finally {
      push.mockRestore();
    }
  });

  it('returns undefined when the input starts with 1 MB of empty stored blocks', () => {
    const tail = bytes(deflateRawSync(new Uint8Array(1024 * 1024)));
    const data = new Uint8Array(200_000 * 5 + tail.length);
    for (let i = 0; i < 200_000; i++) data.set([0, 0, 0, 0xff, 0xff], i * 5);
    data.set(tail, 200_000 * 5);
    expect(inflateRawBounded(data, 64 * 1024 * 1024)).toBeUndefined();
  });

  it('returns empty output for empty input', () => {
    expect(inflateRawBounded(new Uint8Array(0), 0)).toEqual(new Uint8Array(0));
  });

  it('throws the FlateDecode error for data that is not raw DEFLATE, or is cut short', () => {
    const text = encoder.encode('plain text, never compressed\n');
    expect(() => inflateRawBounded(text, 1 << 20)).toThrow(FAILURE);
    expect(() => inflateRawBounded(LONG_RAW.subarray(0, 40_000), 1 << 30)).toThrow(FAILURE);
  });
});

// ---------------------------------------------------------------------------
// inflateSyncFlushedZlib
// ---------------------------------------------------------------------------

describe('inflateSyncFlushedZlib', () => {
  /** Zlib data that ends at a sync flush: no final block and no Adler-32 trailer. */
  const syncFlushed = (data: Uint8Array): Uint8Array =>
    bytes(deflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH }));
  /** node:zlib's reading of such data: the bytes decoded up to the end of the input. */
  const nodeRead = (data: Uint8Array): Uint8Array =>
    bytes(inflateSync(data, { finishFlush: constants.Z_SYNC_FLUSH }));
  const LONG = contentStream(12_000);

  it('starts from data that node:zlib refuses as cut short and that ends with 00 00 ff ff', () => {
    const data = syncFlushed(SAMPLE);
    expect(() => inflateSync(data)).toThrow('unexpected end of file');
    expect([...data.subarray(-4)]).toEqual([0x00, 0x00, 0xff, 0xff]);
  });

  it('returns the bytes decoded up to the sync flush, as node:zlib reads them', () => {
    const data = syncFlushed(SAMPLE);
    expect(inflateSyncFlushedZlib(data, 1 << 20)).toEqual(nodeRead(data));
    expect(inflateSyncFlushedZlib(data, 1 << 20)).toEqual(new Uint8Array(SAMPLE));
  });

  it('reads data that spans several 16 KiB input steps', () => {
    const data = syncFlushed(LONG);
    expect(data.length).toBeGreaterThan(3 * 16 * 1024);
    expect(inflateSyncFlushedZlib(data, LONG.length)).toEqual(new Uint8Array(LONG));
  });

  it('returns empty output for zlib data that holds a sync flush only', () => {
    const data = Uint8Array.of(0x78, 0x9c, 0x00, 0x00, 0x00, 0xff, 0xff);
    expect(nodeRead(data)).toEqual(new Uint8Array(0));
    expect(inflateSyncFlushedZlib(data, 1 << 20)).toEqual(new Uint8Array(0));
  });

  it('returns undefined for complete zlib data, with or without its trailer', () => {
    const complete = bytes(deflateSync(SAMPLE));
    expect(inflateSyncFlushedZlib(complete, 1 << 20)).toBeUndefined();
    expect(inflateSyncFlushedZlib(complete.subarray(0, -4), 1 << 20)).toBeUndefined();
  });

  it('returns undefined for complete zlib data followed by 00 00 ff ff', () => {
    const complete = bytes(deflateSync(SAMPLE));
    const data = new Uint8Array([...complete, 0x00, 0x00, 0xff, 0xff]);
    expect(inflateSyncFlushedZlib(data, 1 << 20)).toBeUndefined();
    // The same with the final block right after a sync flush (Z_SYNC_FLUSH, then Z_FINISH).
    const finished = new Uint8Array([
      ...syncFlushed(SAMPLE),
      ...bytes(deflateRawSync(new Uint8Array(0))),
      0x00,
      0x00,
      0xff,
      0xff,
    ]);
    expect(inflateSyncFlushedZlib(finished, 1 << 20)).toBeUndefined();
  });

  it('returns undefined for data that is not zlib data', () => {
    const raw = bytes(deflateRawSync(SAMPLE, { finishFlush: constants.Z_SYNC_FLUSH }));
    expect(isZlibHeader(raw)).toBe(false);
    expect(inflateSyncFlushedZlib(raw, 1 << 20)).toBeUndefined();
    const text = new Uint8Array([...encoder.encode('plain text'), 0x00, 0x00, 0xff, 0xff]);
    expect(inflateSyncFlushedZlib(text, 1 << 20)).toBeUndefined();
    expect(inflateSyncFlushedZlib(new Uint8Array(0), 1 << 20)).toBeUndefined();
  });

  it('returns undefined for zlib data that is damaged in another way', () => {
    const data = syncFlushed(LONG);
    // Cut inside a block: the data does not end at a sync flush.
    const cut = data.subarray(0, data.length >> 1);
    expect([...cut.subarray(-4)]).not.toEqual([0x00, 0x00, 0xff, 0xff]);
    expect(inflateSyncFlushedZlib(cut, LONG.length)).toBeUndefined();
    // A block of the reserved type 3 after the header, then a sync flush.
    const invalid = Uint8Array.of(0x78, 0x9c, 0x07, 0x00, 0x00, 0x00, 0xff, 0xff);
    expect(() => nodeRead(invalid)).toThrow();
    expect(inflateSyncFlushedZlib(invalid, 1 << 20)).toBeUndefined();
    // Valid blocks, then bytes no DEFLATE decoder reads, then a sync flush.
    const head = syncFlushed(SAMPLE);
    const damaged = new Uint8Array([...head, 0x07, 0xff, 0x00, 0x00, 0x00, 0xff, 0xff]);
    expect(inflateSyncFlushedZlib(damaged, 1 << 20)).toBeUndefined();
  });

  it('returns undefined for data cut inside a stored block that ends with 00 00 ff ff', () => {
    const content = new Uint8Array(50).fill(0x41);
    content.set([0x00, 0x00, 0xff, 0xff], 46);
    const data = new Uint8Array([0x78, 0x9c, 0x00, 100, 0, 0xff - 100, 0xff, ...content]);
    expect(nodeRead(data).length).toBe(50);
    expect(inflateSyncFlushedZlib(data, 1 << 20)).toBeUndefined();
  });

  it('returns the data when the decoded size equals the bound, and undefined above it', () => {
    const data = syncFlushed(LONG);
    expect(inflateSyncFlushedZlib(data, LONG.length)).toEqual(new Uint8Array(LONG));
    expect(inflateSyncFlushedZlib(data, LONG.length - 1)).toBeUndefined();
  });

  it('reads no further input once a step has decoded more than the bound', () => {
    // 64 MiB of zeros: about 64 KB of zlib data, whose first 16 KiB step decodes to more than
    // 1 MiB.
    const zeros = syncFlushed(new Uint8Array(64 * 1024 * 1024));
    expect(zeros.length).toBeGreaterThan(16 * 1024);
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      expect(inflateSyncFlushedZlib(zeros, 1024 * 1024)).toBeUndefined();
      expect(push).toHaveBeenCalledTimes(1);
    } finally {
      push.mockRestore();
    }
  });

  it('stops reading when 128 KiB of input in a row decode to no bytes', () => {
    // Complete data, then 16 MiB of bytes that end with 00 00 ff ff: the inflater ignores
    // bytes after the final block, so eight steps decode to nothing.
    const complete = bytes(deflateSync(encoder.encode('hello world')));
    const tail = new Uint8Array(complete.length + 16 * 1024 * 1024).fill(0x41);
    tail.set(complete);
    tail.set([0x00, 0x00, 0xff, 0xff], tail.length - 4);
    // 1 MB of empty stored blocks after the header: no step decodes a byte.
    const empty = new Uint8Array(2 + 200_000 * 5);
    empty.set([0x78, 0x9c]);
    for (let i = 0; i < 200_000; i++) empty.set([0, 0, 0, 0xff, 0xff], 2 + i * 5);
    for (const data of [tail, empty]) {
      const push = vi.spyOn(Inflate.prototype, 'push');
      try {
        expect(inflateSyncFlushedZlib(data, 64 * 1024 * 1024)).toBeUndefined();
        // At most the step that decodes "hello world" and eight steps that decode nothing.
        expect(push.mock.calls.length).toBeLessThanOrEqual(9);
      } finally {
        push.mockRestore();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// isZlibHeader
// ---------------------------------------------------------------------------

describe('isZlibHeader', () => {
  it.each([
    ['78 01', [0x78, 0x01]],
    ['78 5e', [0x78, 0x5e]],
    ['78 9c', [0x78, 0x9c]],
    ['78 da', [0x78, 0xda]],
    ['08 1d (CINFO 0)', [0x08, 0x1d]],
    ['68 81 (CINFO 6)', [0x68, 0x81]],
  ])('accepts %s', (_label, header) => {
    expect(((header[0] ?? 0) * 256 + (header[1] ?? 0)) % 31).toBe(0);
    expect(isZlibHeader(new Uint8Array(header))).toBe(true);
  });

  it.each([
    ['78 bb (FDICT set)', [0x78, 0xbb]],
    ['88 1c (CINFO 8)', [0x88, 0x1c]],
    ['77 09 (CM 7)', [0x77, 0x09]],
    ['78 9d (FCHECK wrong)', [0x78, 0x9d]],
    ['1f 8b (gzip)', [0x1f, 0x8b]],
  ])('rejects %s', (_label, header) => {
    expect(isZlibHeader(new Uint8Array(header))).toBe(false);
  });

  it('rejects fewer than two bytes', () => {
    expect(isZlibHeader(new Uint8Array(0))).toBe(false);
    expect(isZlibHeader(new Uint8Array([0x78]))).toBe(false);
  });

  it('accepts the header of node:zlib output at every level', () => {
    for (let level = 0; level <= 9; level++) {
      expect(isZlibHeader(bytes(deflateSync(SAMPLE, { level })))).toBe(true);
    }
  });

  it('rejects raw DEFLATE output of node:zlib at levels 0, 1, 6 and 9', () => {
    for (const level of [0, 1, 6, 9]) {
      expect(isZlibHeader(bytes(deflateRawSync(SAMPLE, { level })))).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// adler32 and wrapRawDeflate
// ---------------------------------------------------------------------------

describe('adler32', () => {
  it('matches the RFC 1950 checksum of "Wikipedia"', () => {
    expect(adler32(encoder.encode('Wikipedia'))).toBe(0x11e60398);
  });

  it('is 1 for empty input', () => {
    expect(adler32(new Uint8Array(0))).toBe(1);
  });

  it('matches the trailer node:zlib writes for a long run of 0xff', () => {
    const data = new Uint8Array(100_000).fill(0xff);
    const zlib = bytes(deflateSync(data));
    const view = new DataView(zlib.buffer, zlib.byteOffset, zlib.byteLength);
    expect(adler32(data)).toBe(view.getUint32(zlib.length - 4));
  });
});

describe('wrapRawDeflate', () => {
  it('turns raw DEFLATE into zlib data node:zlib accepts', () => {
    const wrapped = wrapRawDeflate(bytes(deflateRawSync(SAMPLE)), SAMPLE);
    expect(bytes(inflateSync(wrapped))).toEqual(SAMPLE);
    expect(isZlibHeader(wrapped)).toBe(true);
  });

  it('keeps the DEFLATE payload byte for byte between header and trailer', () => {
    const raw = bytes(deflateRawSync(SAMPLE, { level: 9 }));
    const wrapped = wrapRawDeflate(raw, SAMPLE);
    expect(wrapped.length).toBe(raw.length + 6);
    expect(wrapped.subarray(2, wrapped.length - 4)).toEqual(raw);
  });

  it('wraps the raw DEFLATE of empty input', () => {
    const empty = new Uint8Array(0);
    const wrapped = wrapRawDeflate(bytes(deflateRawSync(empty)), empty);
    expect(bytes(inflateSync(wrapped)).length).toBe(0);
  });

  it('wraps stored blocks (level 0)', () => {
    const data = byteRamp(1000);
    const wrapped = wrapRawDeflate(bytes(deflateRawSync(data, { level: 0 })), data);
    expect(bytes(inflateSync(wrapped))).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// Decoded-size limit
// ---------------------------------------------------------------------------

/** A few MiB of mixed data: pseudo-random runs, repeated text and noise, so every block type occurs. */
function variedData(size: number): Uint8Array {
  const data = new Uint8Array(size);
  let state = 12345;
  const next = (): number => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state >>> 16;
  };
  const line = encoder.encode('BT /F1 12 Tf 72 700 Td (A line of the sample page) Tj ET\n');
  let at = 0;
  while (at < size) {
    const kind = next() % 3;
    const run = 1 + (next() % 4096);
    for (let i = 0; i < run && at < size; i++, at++) {
      data[at] = kind === 0 ? next() & 0xff : kind === 1 ? (line[i % line.length] ?? 0) : 0x20;
    }
  }
  return data;
}

describe('decoded-size limit', () => {
  const VARIED = variedData(4 * 1024 * 1024);
  const ZLIB = bytes(deflateSync(VARIED));
  const RAW = bytes(deflateRawSync(VARIED));

  it('decodes a few MiB of varied data as node:zlib does, in zlib and raw form', () => {
    expect(inflateFlate(ZLIB)).toEqual(VARIED);
    expect(inflateFlate(RAW)).toEqual(VARIED);
    expect(inflateRaw(RAW)).toEqual(VARIED);
  });

  it('decodes zlib data whose Adler-32 trailer is missing as node:zlib decodes its payload', () => {
    const cut = ZLIB.subarray(0, ZLIB.length - 4);
    expect(inflateFlate(cut)).toEqual(VARIED);
    expect(inflateFlate(cut)).toEqual(bytes(inflateRawSync(cut.subarray(2))));
  });

  it('stops reading at the final block and ignores 16 MiB of bytes after it', () => {
    const zlib = bytes(deflateSync(encoder.encode('hello world')));
    const raw = bytes(deflateRawSync(encoder.encode('hello world')));
    for (const [call, stream] of [
      [inflateFlate, zlib],
      [inflateFlate, raw],
      [inflateRaw, raw],
    ] as const) {
      const data = new Uint8Array(stream.length + 16 * 1024 * 1024).fill(0x41);
      data.set(stream);
      const push = vi.spyOn(Inflate.prototype, 'push');
      try {
        expect(call(data)).toEqual(encoder.encode('hello world'));
        expectReadStopsEarly(push, data.length);
      } finally {
        push.mockRestore();
      }
    }
  });

  it('keeps the FlateDecode error for data that is cut short, below the limit', () => {
    expect(() => inflateFlate(RAW.subarray(0, RAW.length >> 1))).toThrow(FAILURE);
    expect(() => inflateRaw(RAW.subarray(0, RAW.length >> 1))).toThrow(FAILURE);
  });

  it('throws the FlateDecode error when 1 MB of empty stored blocks comes before the data', () => {
    const tail = bytes(deflateRawSync(new Uint8Array(1024)));
    const data = new Uint8Array(200_000 * 5 + tail.length);
    for (let i = 0; i < 200_000; i++) data.set([0, 0, 0, 0xff, 0xff], i * 5);
    data.set(tail, 200_000 * 5);
    expect(() => inflateRaw(data)).toThrow(FAILURE);
    expect(() => inflateFlate(data)).toThrow(FAILURE);
  });
});

// ---------------------------------------------------------------------------
// inflateFlateUpTo
// ---------------------------------------------------------------------------

describe('inflateFlateUpTo', () => {
  const VARIED = variedData(4 * 1024 * 1024);
  const ZLIB = bytes(deflateSync(VARIED));
  const RAW = bytes(deflateRawSync(VARIED));
  const ZEROS = bytes(deflateSync(new Uint8Array(4 * 1024 * 1024)));

  it('returns all the data and no stop flag when the decoded size is under or equals the bound', () => {
    for (const stream of [ZLIB, RAW]) {
      for (const bound of [VARIED.length, VARIED.length + 1, 64 * 1024 * 1024]) {
        const result = inflateFlateUpTo(stream, bound);
        expect(result.truncated).toBe(false);
        expect(result.data).toEqual(VARIED);
      }
    }
  });

  it('returns the first N bytes and the stop flag when the data decodes to more than N', () => {
    for (const stream of [ZLIB, RAW]) {
      for (const bound of [0, 1, 1000, VARIED.length - 1]) {
        const result = inflateFlateUpTo(stream, bound);
        expect(result.truncated).toBe(true);
        expect(result.data.length).toBe(bound);
        expect(result.data).toEqual(VARIED.subarray(0, bound));
      }
    }
  });

  it('matches node:zlib on the prefix it returns, for zlib data with a missing trailer', () => {
    const cut = ZLIB.subarray(0, ZLIB.length - 4);
    const result = inflateFlateUpTo(cut, 100_000);
    expect(result.data).toEqual(bytes(inflateRawSync(cut.subarray(2))).subarray(0, 100_000));
  });

  it('reads no further input once a step has decoded more than N bytes, zlib form', () => {
    // 64 MiB of zeros: about 64 KB of zlib data, more than one 16 KiB step.
    const stream = bytes(deflateSync(new Uint8Array(64 * 1024 * 1024)));
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      expect(stream.length).toBeGreaterThan(16 * 1024);
      expect(inflateFlateUpTo(stream, 1024).truncated).toBe(true);
      // One push: the zlib read stopped, and the data was not read again as raw DEFLATE.
      expect(push).toHaveBeenCalledTimes(1);
    } finally {
      push.mockRestore();
    }
  });

  it('reads no further input once a step has decoded more than N bytes, raw form', () => {
    // 64 MiB of zeros: about 64 KB of DEFLATE, whose first 16 KiB step decodes to more than 1 MiB.
    const zeros = bytes(deflateRawSync(new Uint8Array(64 * 1024 * 1024)));
    expect(zeros.length).toBeGreaterThan(16 * 1024);
    expect(isZlibHeader(zeros)).toBe(false);
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      const result = inflateFlateUpTo(zeros, 1024 * 1024);
      expect(result.truncated).toBe(true);
      expect(result.data.length).toBe(1024 * 1024);
      expect(push).toHaveBeenCalledTimes(1);
    } finally {
      push.mockRestore();
    }
  });

  it('ignores 16 MiB of bytes after the final block without reading them', () => {
    const zlib = bytes(deflateSync(encoder.encode('hello world')));
    const data = new Uint8Array(zlib.length + 16 * 1024 * 1024).fill(0x41);
    data.set(zlib);
    const push = vi.spyOn(Inflate.prototype, 'push');
    try {
      const result = inflateFlateUpTo(data, 1024 * 1024);
      expect(result).toEqual({ data: encoder.encode('hello world'), truncated: false });
      expectReadStopsEarly(push, data.length);
    } finally {
      push.mockRestore();
    }
  });

  it('refuses a bound above maxDecodedStreamBytes, or not a number, with ResourceLimitError', () => {
    for (const bound of [INTERNAL_LIMITS.maxDecodedStreamBytes + 1, Number.NaN, Infinity]) {
      let caught: unknown;
      try {
        inflateFlateUpTo(ZEROS, bound);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ResourceLimitError);
      expect(caught).toMatchObject({
        code: 'resource-limit-exceeded',
        limit: 'maxDecodedStreamBytes',
        max: INTERNAL_LIMITS.maxDecodedStreamBytes,
      });
    }
    expect(() => inflateFlateUpTo(ZEROS, INTERNAL_LIMITS.maxDecodedStreamBytes + 1)).toThrow(
      'Input exceeds the internal limit maxDecodedStreamBytes (268435456 bytes).',
    );
  });

  it('accepts a bound equal to maxDecodedStreamBytes', () => {
    expect(inflateFlateUpTo(ZEROS, INTERNAL_LIMITS.maxDecodedStreamBytes).truncated).toBe(false);
  });

  it('keeps the FlateDecode error for data that does not inflate, or is cut short', () => {
    expect(() => inflateFlateUpTo(encoder.encode('plain text, never compressed\n'), 100)).toThrow(
      FAILURE,
    );
    expect(() => inflateFlateUpTo(RAW.subarray(0, RAW.length >> 1), VARIED.length)).toThrow(
      FAILURE,
    );
  });

  it('returns empty output for empty input', () => {
    expect(inflateFlateUpTo(new Uint8Array(0), 10)).toEqual({
      data: new Uint8Array(0),
      truncated: false,
    });
  });
});
