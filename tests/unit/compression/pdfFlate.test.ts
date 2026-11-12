/**
 * Tests for the FlateDecode codec (src/compression/pdfFlate.ts).
 *
 * node:zlib is the oracle: its `inflateSync` checks the RFC 1950 header and
 * the Adler-32 trailer, so output it accepts is zlib data as ISO 32000
 * requires under /FlateDecode. Inputs for the decoder are built with
 * node:zlib too (`deflateSync` for zlib, `deflateRawSync` for raw DEFLATE,
 * `gzipSync` for gzip), never with the codec under test.
 */

import { describe, it, expect, vi } from 'vitest';
import { deflateRawSync, deflateSync, gzipSync, inflateRawSync, inflateSync } from 'node:zlib';
import { Inflate } from 'fflate';
import {
  adler32,
  flateEncode,
  inflateFlate,
  inflateRaw,
  inflateRawBounded,
  isZlibHeader,
  wrapRawDeflate,
} from '../../../src/compression/pdfFlate.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** Copy any byte view (Buffer included) into a plain Uint8Array. */
function bytes(view: Uint8Array): Uint8Array {
  return Uint8Array.from(view);
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

  it('reads raw DEFLATE data followed by 16 MiB of other bytes in less than a second', () => {
    const raw = bytes(deflateRawSync(encoder.encode('hello world')));
    const data = new Uint8Array(raw.length + 16 * 1024 * 1024).fill(0x41);
    data.set(raw);
    const start = performance.now();
    const result = inflateRawBounded(data, 64 * 1024 * 1024);
    const elapsed = performance.now() - start;
    expect(result).toEqual(encoder.encode('hello world'));
    expect(elapsed).toBeLessThan(1000);
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
