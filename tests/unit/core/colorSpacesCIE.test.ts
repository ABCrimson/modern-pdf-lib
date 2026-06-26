/**
 * Tests for device-independent CIE colour spaces (ISO 32000-2 §8.6.5):
 * CalGray, CalRGB, Lab builders and the Lab → sRGB conversion.
 */

import { describe, it, expect } from 'vitest';

import {
  buildCalGray,
  buildCalRGB,
  buildLab,
  labToRgb,
} from '../../../src/core/colorSpacesCIE.ts';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  type PdfObject,
} from '../../../src/core/pdfObjects.ts';

const D65_WHITE: readonly [number, number, number] = [0.9505, 1.0, 1.089];

/** Assert an object is a PdfArray of numbers and return the values. */
function numbersOf(obj: PdfObject | undefined): number[] {
  expect(obj).toBeInstanceOf(PdfArray);
  const arr = obj as PdfArray;
  return arr.items.map((item) => {
    expect(item).toBeInstanceOf(PdfNumber);
    return (item as PdfNumber).value;
  });
}

/** Assert the space array shape `[/Name << dict >>]` and return both. */
function destructureSpace(
  space: PdfArray,
  expectedName: string,
): { name: PdfName; dict: PdfDict } {
  expect(space).toBeInstanceOf(PdfArray);
  expect(space.length).toBe(2);
  const [name, dict] = space.items;
  expect(name).toBeInstanceOf(PdfName);
  expect((name as PdfName).value).toBe(expectedName);
  expect(dict).toBeInstanceOf(PdfDict);
  return { name: name as PdfName, dict: dict as PdfDict };
}

describe('buildCalGray', () => {
  it('emits [/CalGray << /WhitePoint >>] with only required key', () => {
    const space = buildCalGray({ whitePoint: [0.9505, 1.0, 1.089] });
    const { dict } = destructureSpace(space, '/CalGray');

    expect(numbersOf(dict.get('/WhitePoint'))).toEqual([0.9505, 1.0, 1.089]);
    expect(dict.has('/BlackPoint')).toBe(false);
    expect(dict.has('/Gamma')).toBe(false);
    expect(dict.size).toBe(1);
  });

  it('includes optional BlackPoint and Gamma when provided', () => {
    const space = buildCalGray({
      whitePoint: [1, 1, 1],
      blackPoint: [0, 0, 0],
      gamma: 2.2,
    });
    const { dict } = destructureSpace(space, '/CalGray');

    expect(numbersOf(dict.get('/BlackPoint'))).toEqual([0, 0, 0]);
    const gamma = dict.get('/Gamma');
    expect(gamma).toBeInstanceOf(PdfNumber);
    expect((gamma as PdfNumber).value).toBe(2.2);
    expect(dict.size).toBe(3);
  });
});

describe('buildCalRGB', () => {
  it('emits [/CalRGB << /WhitePoint >>] with only required key', () => {
    const space = buildCalRGB({ whitePoint: [0.9505, 1.0, 1.089] });
    const { dict } = destructureSpace(space, '/CalRGB');

    expect(numbersOf(dict.get('/WhitePoint'))).toEqual([0.9505, 1.0, 1.089]);
    expect(dict.has('/BlackPoint')).toBe(false);
    expect(dict.has('/Gamma')).toBe(false);
    expect(dict.has('/Matrix')).toBe(false);
    expect(dict.size).toBe(1);
  });

  it('includes per-component Gamma and 9-element Matrix', () => {
    const matrix = [
      0.4124, 0.2126, 0.0193, 0.3576, 0.7152, 0.1192, 0.1805, 0.0722, 0.9505,
    ];
    const space = buildCalRGB({
      whitePoint: [0.9505, 1.0, 1.089],
      blackPoint: [0, 0, 0],
      gamma: [2.2, 2.2, 2.2],
      matrix,
    });
    const { dict } = destructureSpace(space, '/CalRGB');

    expect(numbersOf(dict.get('/Gamma'))).toEqual([2.2, 2.2, 2.2]);
    expect(numbersOf(dict.get('/Matrix'))).toEqual(matrix);
    expect(numbersOf(dict.get('/BlackPoint'))).toEqual([0, 0, 0]);
    expect(dict.size).toBe(4);
  });
});

describe('buildLab', () => {
  it('emits [/Lab << /WhitePoint >>] with only required key', () => {
    const space = buildLab({ whitePoint: [0.9642, 1.0, 0.8249] });
    const { dict } = destructureSpace(space, '/Lab');

    expect(numbersOf(dict.get('/WhitePoint'))).toEqual([0.9642, 1.0, 0.8249]);
    expect(dict.has('/BlackPoint')).toBe(false);
    expect(dict.has('/Range')).toBe(false);
    expect(dict.size).toBe(1);
  });

  it('includes optional BlackPoint and 4-element Range', () => {
    const space = buildLab({
      whitePoint: [0.9642, 1.0, 0.8249],
      blackPoint: [0, 0, 0],
      range: [-128, 127, -128, 127],
    });
    const { dict } = destructureSpace(space, '/Lab');

    expect(numbersOf(dict.get('/Range'))).toEqual([-128, 127, -128, 127]);
    expect(numbersOf(dict.get('/BlackPoint'))).toEqual([0, 0, 0]);
    expect(dict.size).toBe(3);
  });
});

describe('labToRgb', () => {
  it('maps L=100 (a=b=0) to white', () => {
    const [r, g, b] = labToRgb(100, 0, 0);
    expect(r).toBeCloseTo(1, 2);
    expect(g).toBeCloseTo(1, 2);
    expect(b).toBeCloseTo(1, 2);
  });

  it('maps L=0 (a=b=0) to black', () => {
    const [r, g, b] = labToRgb(0, 0, 0);
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it('maps a neutral mid lightness to an equal-channel grey', () => {
    const [r, g, b] = labToRgb(50, 0, 0);
    // Neutral Lab (a=b=0) must yield r ≈ g ≈ b.
    expect(r).toBeCloseTo(g, 2);
    expect(g).toBeCloseTo(b, 2);
    // L*=50 is mid lightness; sRGB value lands near the middle of the range.
    expect(r).toBeGreaterThan(0.4);
    expect(r).toBeLessThan(0.55);
  });

  it('round-trips sRGB red (Lab 53.24, 80.09, 67.20) back to red', () => {
    const [r, g, b] = labToRgb(53.24, 80.09, 67.2);
    expect(r).toBeCloseTo(0.982, 2);
    expect(g).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0.026, 2);
  });

  it('maps a strong blue Lab colour to a blue-dominant sRGB triple', () => {
    const [r, g, b] = labToRgb(32.3, 79.19, -107.86);
    // The blue channel saturates and dominates the others.
    expect(b).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeGreaterThan(r);
  });

  it('clamps out-of-gamut colours into the 0..1 range', () => {
    const [r, g, b] = labToRgb(60, 120, -120);
    for (const c of [r, g, b]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('honours a custom (D65) white point', () => {
    const [r, g, b] = labToRgb(100, 0, 0, D65_WHITE);
    // L=100 white maps near the top of the range for a D65 white point.
    expect(r).toBeGreaterThan(0.9);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
  });
});
