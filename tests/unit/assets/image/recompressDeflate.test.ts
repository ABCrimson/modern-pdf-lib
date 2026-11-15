/**
 * Tests for recompressImage() with the default `'deflate'` format: the output is zlib data
 * (RFC 1950), the format /FlateDecode requires, judged by node:zlib `inflateSync`, whatever
 * the runtime offers.
 */

import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { recompressImage } from '../../../../src/assets/image/optimize/imageOptimize.js';
import type { RawImageData } from '../../../../src/assets/image/optimize/imageOptimize.js';

const PHRASE = 'the quick brown fox jumps over the lazy dog ';

/** A 64x64 RGB image of repeated text bytes: compressible, and much smaller at level 9 than 1. */
function textImage(): RawImageData {
  const width = 64;
  const height = 64;
  const pixels = new Uint8Array(width * height * 3).map((_, i) =>
    PHRASE.charCodeAt((i * 7 + (i >> 5)) % PHRASE.length),
  );
  return { pixels, width, height, channels: 3, bitsPerChannel: 8 };
}

describe('recompressImage deflate output', () => {
  it('is zlib data without the CompressionStream API', async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'CompressionStream');
    // @ts-expect-error -- removed for this test only, restored below
    delete globalThis.CompressionStream;
    try {
      expect(typeof globalThis.CompressionStream).toBe('undefined');
      const image = textImage();
      const result = await recompressImage(image);
      expect(result.format).toBe('deflate');
      expect(new Uint8Array(inflateSync(result.data))).toEqual(new Uint8Array(image.pixels));
    } finally {
      if (saved !== undefined) Object.defineProperty(globalThis, 'CompressionStream', saved);
    }
  });

  it('is zlib data and honours compressionLevel', async () => {
    const image = textImage();
    const fast = await recompressImage(image, { compressionLevel: 1 });
    const best = await recompressImage(image, { compressionLevel: 9 });
    expect(new Uint8Array(inflateSync(fast.data))).toEqual(new Uint8Array(image.pixels));
    expect(new Uint8Array(inflateSync(best.data))).toEqual(new Uint8Array(image.pixels));
    expect(best.data.length).not.toBe(fast.data.length);
  });
});
