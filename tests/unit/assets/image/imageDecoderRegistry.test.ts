/**
 * Tests for the pluggable image decoder registry.
 *
 * Covers registerImageDecoder(), unregisterImageDecoder(), hasImageDecoder(),
 * getImageDecoder(), and decodeRegisteredImage() from the
 * imageDecoderRegistry module.
 *
 * The registry itself performs NO decoding — these tests supply fake decoders.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  registerImageDecoder,
  unregisterImageDecoder,
  hasImageDecoder,
  getImageDecoder,
  decodeRegisteredImage,
  type DecodedRasterImage,
  type ImageDecoder,
} from '../../../../src/assets/image/imageDecoderRegistry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid 1x1 RGBA decoder result.
 */
function makeValidResult(): DecodedRasterImage {
  return {
    width: 1,
    height: 1,
    rgba: new Uint8Array([255, 0, 0, 255]),
  };
}

// Keep tests independent: remove every format any test could have registered.
afterEach(() => {
  for (const format of ['avif', 'heic', 'jpegxl', 'webp', 'AVIF', ' Avif ']) {
    unregisterImageDecoder(format);
  }
});

// ---------------------------------------------------------------------------
// hasImageDecoder / register / unregister
// ---------------------------------------------------------------------------

describe('hasImageDecoder', () => {
  it('is false initially for an unregistered format', () => {
    expect(hasImageDecoder('avif')).toBe(false);
  });

  it('is true after registering a decoder', () => {
    registerImageDecoder('avif', () => makeValidResult());
    expect(hasImageDecoder('avif')).toBe(true);
  });

  it('normalizes the format key (trim + lowercase)', () => {
    registerImageDecoder('  AVIF  ', () => makeValidResult());
    expect(hasImageDecoder('avif')).toBe(true);
    expect(hasImageDecoder('AVIF')).toBe(true);
    expect(hasImageDecoder(' Avif ')).toBe(true);
  });
});

describe('unregisterImageDecoder', () => {
  it('removes a registered decoder', () => {
    registerImageDecoder('avif', () => makeValidResult());
    expect(hasImageDecoder('avif')).toBe(true);
    unregisterImageDecoder('avif');
    expect(hasImageDecoder('avif')).toBe(false);
  });

  it('is a no-op for a format that was never registered', () => {
    expect(() => unregisterImageDecoder('heic')).not.toThrow();
    expect(hasImageDecoder('heic')).toBe(false);
  });

  it('normalizes the key when removing', () => {
    registerImageDecoder('avif', () => makeValidResult());
    unregisterImageDecoder('  AVIF ');
    expect(hasImageDecoder('avif')).toBe(false);
  });
});

describe('getImageDecoder', () => {
  it('returns the registered decoder function', () => {
    const decoder: ImageDecoder = () => makeValidResult();
    registerImageDecoder('avif', decoder);
    expect(getImageDecoder('avif')).toBe(decoder);
  });

  it('returns undefined for an unregistered format', () => {
    expect(getImageDecoder('heic')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// decodeRegisteredImage
// ---------------------------------------------------------------------------

describe('decodeRegisteredImage', () => {
  it('returns the decoder RGBA for a registered format', async () => {
    const result = makeValidResult();
    registerImageDecoder('avif', () => result);
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18]);
    const decoded = await decodeRegisteredImage('avif', bytes);
    expect(decoded.width).toBe(1);
    expect(decoded.height).toBe(1);
    expect(Array.from(decoded.rgba)).toEqual([255, 0, 0, 255]);
  });

  it('awaits an async decoder', async () => {
    registerImageDecoder('jpegxl', async () => {
      return Promise.resolve({
        width: 2,
        height: 1,
        rgba: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      });
    });
    const decoded = await decodeRegisteredImage('jpegxl', new Uint8Array([0xFF, 0x0A]));
    expect(decoded.width).toBe(2);
    expect(decoded.rgba.length).toBe(8);
  });

  it('passes the input bytes to the decoder', async () => {
    let seen: Uint8Array | undefined;
    registerImageDecoder('avif', (bytes) => {
      seen = bytes;
      return makeValidResult();
    });
    const input = new Uint8Array([9, 8, 7, 6]);
    await decodeRegisteredImage('avif', input);
    expect(seen).toBe(input);
  });

  it('looks up using the normalized key', async () => {
    registerImageDecoder('avif', () => makeValidResult());
    const decoded = await decodeRegisteredImage('  AVIF  ', new Uint8Array([0]));
    expect(decoded.width).toBe(1);
  });

  it('throws a clear error for an unregistered format, naming it and how to register', async () => {
    await expect(
      decodeRegisteredImage('heic', new Uint8Array([0])),
    ).rejects.toThrow(/heic/i);
    await expect(
      decodeRegisteredImage('heic', new Uint8Array([0])),
    ).rejects.toThrow(/registerImageDecoder/);
  });

  it('throws when the decoder returns the wrong rgba length', async () => {
    registerImageDecoder('avif', () => ({
      width: 2,
      height: 2, // expects 2*2*4 = 16 bytes
      rgba: new Uint8Array([0, 0, 0, 0]), // only 4
    }));
    await expect(
      decodeRegisteredImage('avif', new Uint8Array([0])),
    ).rejects.toThrow(/avif/i);
    await expect(
      decodeRegisteredImage('avif', new Uint8Array([0])),
    ).rejects.toThrow(/16/);
  });

  it('throws when the decoder returns a non-object result', async () => {
    registerImageDecoder('avif', () => undefined as unknown as DecodedRasterImage);
    await expect(
      decodeRegisteredImage('avif', new Uint8Array([0])),
    ).rejects.toThrow(/avif/i);
  });

  it('throws when width/height are not positive integers', async () => {
    registerImageDecoder('avif', () => ({
      width: 0,
      height: 1,
      rgba: new Uint8Array([]),
    }));
    await expect(
      decodeRegisteredImage('avif', new Uint8Array([0])),
    ).rejects.toThrow();
  });

  it('throws when rgba is not a Uint8Array', async () => {
    registerImageDecoder('avif', () => ({
      width: 1,
      height: 1,
      rgba: [255, 0, 0, 255] as unknown as Uint8Array,
    }));
    await expect(
      decodeRegisteredImage('avif', new Uint8Array([0])),
    ).rejects.toThrow();
  });
});
