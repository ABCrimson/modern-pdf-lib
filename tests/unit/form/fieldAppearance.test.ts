/**
 * Tests for field appearance stream generation.
 */

import { describe, it, expect } from 'vitest';
import { PdfStream, PdfName, PdfArray } from '../../../src/core/pdfObjects.js';
import {
  generateTextAppearance,
  generateCheckboxAppearance,
  generateRadioAppearance,
  generateDropdownAppearance,
  generateListboxAppearance,
  generateButtonAppearance,
  generateSignatureAppearance,
} from '../../../src/form/fieldAppearance.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const decoder = new TextDecoder();

function streamContent(stream: PdfStream): string {
  return decoder.decode(stream.data);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fieldAppearance', () => {
  // -------------------------------------------------------------------------
  // Text appearance
  // -------------------------------------------------------------------------

  describe('generateTextAppearance', () => {
    it('returns a PdfStream', () => {
      const stream = generateTextAppearance({
        value: 'Hello',
        rect: [0, 0, 200, 30],
      });
      expect(stream).toBeInstanceOf(PdfStream);
    });

    it('contains BT/ET and Tf operators', () => {
      const stream = generateTextAppearance({
        value: 'Hello',
        rect: [0, 0, 200, 30],
      });
      const content = streamContent(stream);
      expect(content).toContain('BT');
      expect(content).toContain('Tf');
      expect(content).toContain('ET');
    });

    it('contains the text value', () => {
      const stream = generateTextAppearance({
        value: 'World',
        rect: [0, 0, 200, 30],
      });
      const content = streamContent(stream);
      expect(content).toContain('World');
    });

    it('uses specified font name', () => {
      const stream = generateTextAppearance({
        value: 'Test',
        rect: [0, 0, 200, 30],
        fontName: 'Cour',
      });
      const content = streamContent(stream);
      expect(content).toContain('/Cour');
    });

    it('uses specified font size', () => {
      const stream = generateTextAppearance({
        value: 'Test',
        rect: [0, 0, 200, 30],
        fontSize: 14,
      });
      const content = streamContent(stream);
      expect(content).toContain('14 Tf');
    });

    it('handles multiline text', () => {
      const stream = generateTextAppearance({
        value: 'Line1\nLine2\nLine3',
        rect: [0, 0, 200, 100],
        multiline: true,
      });
      const content = streamContent(stream);
      expect(content).toContain('Line1');
      expect(content).toContain('Line2');
      expect(content).toContain('Line3');
    });

    it('has proper BBox in stream dict', () => {
      const stream = generateTextAppearance({
        value: 'X',
        rect: [10, 20, 210, 50],
      });
      const bbox = stream.dict.get('/BBox');
      expect(bbox).toBeDefined();
      expect(bbox!.kind).toBe('array');
      const arr = bbox as PdfArray;
      expect(arr.items).toHaveLength(4);
    });

    it('has /Type /XObject /Subtype /Form', () => {
      const stream = generateTextAppearance({
        value: 'X',
        rect: [0, 0, 100, 20],
      });
      const dict = stream.dict;
      const type = dict.get('/Type');
      expect(type).toBeDefined();
      expect(type!.kind).toBe('name');
      expect((type as PdfName).value).toBe('/XObject');

      const subtype = dict.get('/Subtype');
      expect(subtype).toBeDefined();
      expect((subtype as PdfName).value).toBe('/Form');
    });

    it('includes /Resources with font', () => {
      const stream = generateTextAppearance({
        value: 'Test',
        rect: [0, 0, 200, 30],
      });
      expect(stream.dict.has('/Resources')).toBe(true);
    });

    it('escapes special characters in text', () => {
      const stream = generateTextAppearance({
        value: 'Hello (world) \\ test',
        rect: [0, 0, 200, 30],
      });
      const content = streamContent(stream);
      // Parentheses should be escaped
      expect(content).toContain('\\(world\\)');
      expect(content).toContain('\\\\');
    });

    it('handles empty text', () => {
      const stream = generateTextAppearance({
        value: '',
        rect: [0, 0, 200, 30],
      });
      expect(stream).toBeInstanceOf(PdfStream);
      const content = streamContent(stream);
      expect(content).toContain('BT');
    });
  });

  // -------------------------------------------------------------------------
  // Checkbox appearance
  // -------------------------------------------------------------------------

  describe('generateCheckboxAppearance', () => {
    it('returns a PdfStream for checked state', () => {
      const stream = generateCheckboxAppearance({
        checked: true,
        rect: [0, 0, 20, 20],
      });
      expect(stream).toBeInstanceOf(PdfStream);
      const content = streamContent(stream);
      // Checked should have drawing operators
      expect(content).toContain('S'); // stroke
    });

    it('returns a PdfStream for unchecked state', () => {
      const stream = generateCheckboxAppearance({
        checked: false,
        rect: [0, 0, 20, 20],
      });
      expect(stream).toBeInstanceOf(PdfStream);
    });

    it('has proper BBox dimensions', () => {
      const stream = generateCheckboxAppearance({
        checked: true,
        rect: [0, 0, 15, 15],
      });
      const bbox = stream.dict.get('/BBox') as PdfArray;
      expect(bbox).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Radio appearance
  // -------------------------------------------------------------------------

  describe('generateRadioAppearance', () => {
    it('returns a PdfStream for selected state', () => {
      const stream = generateRadioAppearance({
        selected: true,
        rect: [0, 0, 20, 20],
      });
      expect(stream).toBeInstanceOf(PdfStream);
      const content = streamContent(stream);
      // Selected should have filled circle (rg + f)
      expect(content).toContain('f');
    });

    it('returns a PdfStream for unselected state', () => {
      const stream = generateRadioAppearance({
        selected: false,
        rect: [0, 0, 20, 20],
      });
      expect(stream).toBeInstanceOf(PdfStream);
      const content = streamContent(stream);
      // Unselected should have outer circle stroke but no fill for inner
      expect(content).toContain('S');
    });
  });

  // -------------------------------------------------------------------------
  // Dropdown appearance
  // -------------------------------------------------------------------------

  describe('generateDropdownAppearance', () => {
    it('renders the selected value', () => {
      const stream = generateDropdownAppearance({
        value: 'United States',
        rect: [0, 0, 200, 30],
      });
      const content = streamContent(stream);
      expect(content).toContain('United States');
    });
  });

  // -------------------------------------------------------------------------
  // Listbox appearance
  // -------------------------------------------------------------------------

  describe('generateListboxAppearance', () => {
    it('renders visible options', () => {
      const stream = generateListboxAppearance({
        options: ['Alpha', 'Beta', 'Gamma'],
        selected: ['Beta'],
        rect: [0, 0, 200, 100],
      });
      const content = streamContent(stream);
      expect(content).toContain('Alpha');
      expect(content).toContain('Beta');
      expect(content).toContain('Gamma');
    });

    it('highlights selected items', () => {
      const stream = generateListboxAppearance({
        options: ['A', 'B'],
        selected: ['A'],
        rect: [0, 0, 200, 100],
      });
      const content = streamContent(stream);
      // Selected item should have a highlight background
      expect(content).toContain('rg'); // fill color
    });
  });

  // -------------------------------------------------------------------------
  // Button appearance
  // -------------------------------------------------------------------------

  describe('generateButtonAppearance', () => {
    it('renders the caption text', () => {
      const stream = generateButtonAppearance({
        caption: 'Submit',
        rect: [0, 0, 100, 30],
      });
      const content = streamContent(stream);
      expect(content).toContain('Submit');
    });

    it('has gray background', () => {
      const stream = generateButtonAppearance({
        caption: 'OK',
        rect: [0, 0, 80, 25],
      });
      const content = streamContent(stream);
      expect(content).toContain('0.75 g'); // light gray fill
    });
  });

  // -------------------------------------------------------------------------
  // Signature appearance
  // -------------------------------------------------------------------------

  describe('generateSignatureAppearance', () => {
    it('renders "Signed" text for signed state', () => {
      const stream = generateSignatureAppearance({
        signed: true,
        rect: [0, 0, 200, 50],
      });
      const content = streamContent(stream);
      expect(content).toContain('Signed');
    });

    it('renders dashed border for unsigned state', () => {
      const stream = generateSignatureAppearance({
        signed: false,
        rect: [0, 0, 200, 50],
      });
      const content = streamContent(stream);
      expect(content).toContain('d'); // dash pattern
      expect(content).toContain('S'); // stroke
    });
  });
});
