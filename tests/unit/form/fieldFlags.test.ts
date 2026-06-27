import { test, expect } from 'vitest';
import { FieldFlags } from '../../../src/form/pdfField.js';

/**
 * Every AcroForm field flag must sit on its exact ISO 32000-1 bit. Flag values
 * are field-type specific, so some bits are deliberately shared across types
 * (e.g. RichText for text fields and RadiosInUnison for buttons both = bit 26).
 *
 * Spec bit N (1-indexed, per ISO 32000-1 Tables 226/228/230) = `1 << (N - 1)`.
 */
const bit = (n: number): number => 1 << (n - 1);

test.each([
  // Common (Table 226)
  ['ReadOnly', 1],
  ['Required', 2],
  ['NoExport', 3],
  // Text fields (Table 228)
  ['Multiline', 13],
  ['Password', 14],
  ['DoNotScroll', 24], // regression: was encoded 1<<20 (bit 21 = FileSelect)
  ['RichText', 26],
  // Button fields (Table 226)
  ['NoToggleToOff', 15],
  ['Radio', 16],
  ['Pushbutton', 17],
  ['RadiosInUnison', 26],
  // Choice fields (Table 230)
  ['Combo', 18],
  ['Edit', 19],
  ['Sort', 20],
  ['MultiSelect', 22],
] as const)('FieldFlags.%s is on ISO 32000-1 bit %i', (name, specBit) => {
  expect(FieldFlags[name]).toBe(bit(specBit));
});
