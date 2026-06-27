/**
 * Tests for soft-mask group ExtGState builders (ISO 32000-1 §11.6.5.2).
 *
 * Covers:
 * - Luminosity soft-mask ExtGState shape (/Type /ExtGState, /SMask dict)
 * - /SMask /Type /Mask, /S /Luminosity, /G === groupXObject ref
 * - /BC backdrop-color array (Luminosity only)
 * - /TR transfer function (ref or /Identity name)
 * - Alpha soft mask omits /BC
 * - Default subtype is Luminosity
 * - buildSoftMaskNone → /SMask is the name /None
 */

import { describe, it, expect } from 'vitest';
import {
  buildSoftMaskGroupExtGState,
  buildSoftMaskNone,
} from '../../../src/core/softMask.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfRef,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert a value is a PdfDict and return it narrowed. */
function asDict(value: unknown): PdfDict {
  expect(value).toBeInstanceOf(PdfDict);
  return value as PdfDict;
}

/** Assert a value is a PdfName and return it narrowed. */
function asName(value: unknown): PdfName {
  expect(value).toBeInstanceOf(PdfName);
  return value as PdfName;
}

/** Assert a value is a PdfArray and return it narrowed. */
function asArray(value: unknown): PdfArray {
  expect(value).toBeInstanceOf(PdfArray);
  return value as PdfArray;
}

// ---------------------------------------------------------------------------
// buildSoftMaskGroupExtGState — Luminosity
// ---------------------------------------------------------------------------

describe('buildSoftMaskGroupExtGState (luminosity)', () => {
  it('builds an ExtGState wrapping a luminosity soft-mask group', () => {
    const groupRef = PdfRef.of(7);
    const trRef = PdfRef.of(8);

    const gs = buildSoftMaskGroupExtGState({
      groupXObject: groupRef,
      type: 'Luminosity',
      backdropColor: [0, 0, 0],
      transferFunction: trRef,
    });

    // Outer ExtGState
    expect(asName(gs.get('/Type')).value).toBe('/ExtGState');

    // /SMask dictionary
    const smask = asDict(gs.get('/SMask'));
    expect(asName(smask.get('/Type')).value).toBe('/Mask');
    expect(asName(smask.get('/S')).value).toBe('/Luminosity');

    // /G must be the exact group XObject ref
    expect(smask.get('/G')).toBe(groupRef);

    // /BC backdrop color → 3-number array
    const bc = asArray(smask.get('/BC'));
    expect(bc.items).toHaveLength(3);
    for (const item of bc.items) {
      expect(item).toBeInstanceOf(PdfNumber);
    }
    expect(bc.items.map((n) => (n as PdfNumber).value)).toEqual([0, 0, 0]);

    // /TR is the supplied transfer-function ref
    expect(smask.get('/TR')).toBe(trRef);
  });

  it('accepts the /Identity name for /TR', () => {
    const gs = buildSoftMaskGroupExtGState({
      groupXObject: PdfRef.of(3),
      type: 'Luminosity',
      backdropColor: [0, 0, 0],
      transferFunction: 'Identity',
    });
    const smask = asDict(gs.get('/SMask'));
    expect(asName(smask.get('/TR')).value).toBe('/Identity');
  });

  it('defaults to the Luminosity subtype when type is omitted', () => {
    const gs = buildSoftMaskGroupExtGState({ groupXObject: PdfRef.of(1) });
    const smask = asDict(gs.get('/SMask'));
    expect(asName(smask.get('/S')).value).toBe('/Luminosity');
  });

  it('omits /BC and /TR when not supplied', () => {
    const gs = buildSoftMaskGroupExtGState({ groupXObject: PdfRef.of(1) });
    const smask = asDict(gs.get('/SMask'));
    expect(smask.has('/BC')).toBe(false);
    expect(smask.has('/TR')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildSoftMaskGroupExtGState — Alpha
// ---------------------------------------------------------------------------

describe('buildSoftMaskGroupExtGState (alpha)', () => {
  it('builds an alpha soft mask without /BC', () => {
    const groupRef = PdfRef.of(9);
    const gs = buildSoftMaskGroupExtGState({
      groupXObject: groupRef,
      type: 'Alpha',
      // backdropColor must be ignored for Alpha masks
      backdropColor: [1, 1, 1],
    });

    expect(asName(gs.get('/Type')).value).toBe('/ExtGState');
    const smask = asDict(gs.get('/SMask'));
    expect(asName(smask.get('/Type')).value).toBe('/Mask');
    expect(asName(smask.get('/S')).value).toBe('/Alpha');
    expect(smask.get('/G')).toBe(groupRef);
    expect(smask.has('/BC')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildSoftMaskNone
// ---------------------------------------------------------------------------

describe('buildSoftMaskNone', () => {
  it('builds an ExtGState that clears the soft mask', () => {
    const gs = buildSoftMaskNone();
    expect(asName(gs.get('/Type')).value).toBe('/ExtGState');
    expect(asName(gs.get('/SMask')).value).toBe('/None');
  });
});
