/**
 * Tests for image masks and black-point compensation
 * (ISO 32000-2 §8.9.6 image masks, §8.6.5.9 black-point compensation).
 *
 * Covers:
 * - buildStencilMask() — a 1-bpc /ImageMask image XObject stream with
 *   /Width, /Height, /BitsPerComponent 1, optional /Decode, registered in
 *   the registry and returned as a ref.
 * - buildColorKeyMask() — a color-key /Mask array of (min,max) integer
 *   pairs; rejects an odd-length range list.
 * - buildImageSoftMask() — a DeviceGray image XObject usable as a base
 *   image's /SMask, default 8 bits per component.
 * - buildBlackPointCompensationExtGState() — an ExtGState carrying
 *   /UseBlackPtComp.
 */

import { describe, it, expect } from 'vitest';
import {
  buildStencilMask,
  buildColorKeyMask,
  buildImageSoftMask,
  buildBlackPointCompensationExtGState,
} from '../../../src/core/imageMask.js';
import {
  PdfArray,
  PdfBool,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfStream,
  PdfRef,
  PdfObjectRegistry,
  type ByteWriter,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Serialization helper
// ---------------------------------------------------------------------------

function serialize(obj: { serialize(w: ByteWriter): void }): string {
  let out = '';
  const writer: ByteWriter = {
    write(data: Uint8Array): void {
      out += new TextDecoder('latin1').decode(data);
    },
    writeString(str: string): void {
      out += str;
    },
  };
  obj.serialize(writer);
  return out;
}

/** Resolve a ref to a PdfStream and assert it is one. */
function resolveStream(registry: PdfObjectRegistry, ref: PdfRef): PdfStream {
  const obj = registry.resolve(ref);
  expect(obj).toBeInstanceOf(PdfStream);
  return obj as PdfStream;
}

// ---------------------------------------------------------------------------
// buildStencilMask
// ---------------------------------------------------------------------------

describe('buildStencilMask()', () => {
  it('builds a 1-bpc /ImageMask image XObject stream and registers it', () => {
    const registry = new PdfObjectRegistry();
    const bits = new Uint8Array([0xff]);
    const ref = buildStencilMask(registry, bits, 8, 1);

    expect(ref).toBeInstanceOf(PdfRef);
    const stream = resolveStream(registry, ref);

    expect(stream.dict.get('/Type')).toBe(PdfName.of('XObject'));
    expect(stream.dict.get('/Subtype')).toBe(PdfName.of('Image'));
    expect(stream.dict.get('/ImageMask')).toBe(PdfBool.TRUE);
    expect((stream.dict.get('/BitsPerComponent') as PdfNumber).value).toBe(1);
    expect((stream.dict.get('/Width') as PdfNumber).value).toBe(8);
    expect((stream.dict.get('/Height') as PdfNumber).value).toBe(1);
    expect(stream.data).toBe(bits);
    expect((stream.dict.get('/Length') as PdfNumber).value).toBe(1);

    // No /Decode when not supplied.
    expect(stream.dict.has('/Decode')).toBe(false);

    const s = serialize(stream);
    expect(s).toContain('/Type /XObject');
    expect(s).toContain('/Subtype /Image');
    expect(s).toContain('/ImageMask true');
    expect(s).toContain('/BitsPerComponent 1');
    expect(s).toContain('/Width 8');
    expect(s).toContain('/Height 1');
    expect(s).toContain('stream');
    expect(s).toContain('endstream');
  });

  it('emits a /Decode array when supplied', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildStencilMask(registry, new Uint8Array([0x00]), 8, 1, [1, 0]);
    const stream = resolveStream(registry, ref);

    const decode = stream.dict.get('/Decode');
    expect(decode).toBeInstanceOf(PdfArray);
    const arr = decode as PdfArray;
    expect(arr.length).toBe(2);
    expect((arr.items[0] as PdfNumber).value).toBe(1);
    expect((arr.items[1] as PdfNumber).value).toBe(0);

    expect(serialize(stream)).toContain('/Decode [1 0]');
  });

  it('byte-aligns wider rows (caller-packed) without altering the data', () => {
    // width 9 → ceil(9/8) = 2 bytes/row; height 2 → 4 bytes total.
    const registry = new PdfObjectRegistry();
    const data = new Uint8Array([0xff, 0x80, 0x00, 0x80]);
    const ref = buildStencilMask(registry, data, 9, 2);
    const stream = resolveStream(registry, ref);
    expect((stream.dict.get('/Width') as PdfNumber).value).toBe(9);
    expect((stream.dict.get('/Height') as PdfNumber).value).toBe(2);
    expect(stream.data).toBe(data);
    expect(stream.data.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// buildColorKeyMask
// ---------------------------------------------------------------------------

describe('buildColorKeyMask()', () => {
  it('builds a /Mask array from (min,max) pairs', () => {
    const mask = buildColorKeyMask([0, 0, 0, 0, 0, 0]);
    expect(mask).toBeInstanceOf(PdfArray);
    expect(mask.items.length).toBe(6);
    for (const item of mask.items) {
      expect(item).toBeInstanceOf(PdfNumber);
    }
    expect(serialize(mask)).toBe('[0 0 0 0 0 0]');
  });

  it('preserves the supplied range values', () => {
    const mask = buildColorKeyMask([10, 20, 30, 40]);
    expect(mask.items.length).toBe(4);
    expect((mask.items[0] as PdfNumber).value).toBe(10);
    expect((mask.items[1] as PdfNumber).value).toBe(20);
    expect((mask.items[2] as PdfNumber).value).toBe(30);
    expect((mask.items[3] as PdfNumber).value).toBe(40);
  });

  it('throws on an odd-length range list', () => {
    expect(() => buildColorKeyMask([0, 0, 0])).toThrow(RangeError);
  });

  it('throws on an empty range list', () => {
    expect(() => buildColorKeyMask([])).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// buildImageSoftMask
// ---------------------------------------------------------------------------

describe('buildImageSoftMask()', () => {
  it('builds a DeviceGray /SMask image XObject (default 8 bpc)', () => {
    const registry = new PdfObjectRegistry();
    const gray = new Uint8Array(16);
    const ref = buildImageSoftMask(registry, gray, 4, 4);

    expect(ref).toBeInstanceOf(PdfRef);
    const stream = resolveStream(registry, ref);

    expect(stream.dict.get('/Type')).toBe(PdfName.of('XObject'));
    expect(stream.dict.get('/Subtype')).toBe(PdfName.of('Image'));
    expect(stream.dict.get('/ColorSpace')).toBe(PdfName.of('DeviceGray'));
    expect((stream.dict.get('/BitsPerComponent') as PdfNumber).value).toBe(8);
    expect((stream.dict.get('/Width') as PdfNumber).value).toBe(4);
    expect((stream.dict.get('/Height') as PdfNumber).value).toBe(4);
    expect(stream.data).toBe(gray);
    expect((stream.dict.get('/Length') as PdfNumber).value).toBe(16);

    // A soft mask must NOT be an /ImageMask.
    expect(stream.dict.has('/ImageMask')).toBe(false);

    const s = serialize(stream);
    expect(s).toContain('/Subtype /Image');
    expect(s).toContain('/ColorSpace /DeviceGray');
    expect(s).toContain('/BitsPerComponent 8');
  });

  it('honours an explicit bitsPerComponent', () => {
    const registry = new PdfObjectRegistry();
    const ref = buildImageSoftMask(registry, new Uint8Array([0, 255]), 2, 1, 16);
    const stream = resolveStream(registry, ref);
    expect((stream.dict.get('/BitsPerComponent') as PdfNumber).value).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// buildBlackPointCompensationExtGState
// ---------------------------------------------------------------------------

describe('buildBlackPointCompensationExtGState()', () => {
  it('builds an ExtGState with /UseBlackPtComp /ON', () => {
    const gs = buildBlackPointCompensationExtGState('ON');
    expect(gs).toBeInstanceOf(PdfDict);
    expect(gs.get('/Type')).toBe(PdfName.of('ExtGState'));
    expect(gs.get('/UseBlackPtComp')).toBe(PdfName.of('ON'));
    expect(serialize(gs)).toContain('/UseBlackPtComp /ON');
  });

  it('supports /OFF', () => {
    const gs = buildBlackPointCompensationExtGState('OFF');
    expect(gs.get('/UseBlackPtComp')).toBe(PdfName.of('OFF'));
  });

  it('supports /Default', () => {
    const gs = buildBlackPointCompensationExtGState('Default');
    expect(gs.get('/UseBlackPtComp')).toBe(PdfName.of('Default'));
    expect(serialize(gs)).toContain('/Type /ExtGState');
  });
});
