/**
 * @module tests/unit/compliance/pdfX6
 *
 * Unit tests for PDF/X-6 print-production conformance helpers.
 */

import { describe, it, expect } from 'vitest';

import {
  PdfArray,
  PdfName,
  PdfNumber,
  PdfString,
  type PdfObject,
} from '../../../src/core/pdfObjects.js';
import {
  buildBoxDict,
  buildGtsPdfxVersion,
  buildPdfX6OutputIntent,
  validateBoxGeometry,
  type BoxGeometry,
  type PdfX6Variant,
} from '../../../src/compliance/pdfX6.js';

/** Serialize any PdfObject to a Latin-1 string for assertions. */
function serialize(obj: PdfObject): string {
  let out = '';
  const writer = {
    write(data: Uint8Array): void {
      let s = '';
      for (const b of data) s += String.fromCharCode(b);
      out += s;
    },
    writeString(str: string): void {
      out += str;
    },
  };
  obj.serialize(writer);
  return out;
}

describe('buildPdfX6OutputIntent', () => {
  it('produces a /Type /OutputIntent dict with /S /GTS_PDFX', () => {
    const dict = buildPdfX6OutputIntent({
      outputConditionIdentifier: 'FOGRA51',
    });

    const type = dict.get('/Type');
    expect(type).toBeInstanceOf(PdfName);
    expect((type as PdfName).value).toBe('/OutputIntent');

    const s = dict.get('/S');
    expect(s).toBeInstanceOf(PdfName);
    expect((s as PdfName).value).toBe('/GTS_PDFX');
  });

  it('stores the output condition identifier as a literal string', () => {
    const dict = buildPdfX6OutputIntent({
      outputConditionIdentifier: 'FOGRA51',
    });
    const id = dict.get('/OutputConditionIdentifier');
    expect(id).toBeInstanceOf(PdfString);
    expect((id as PdfString).value).toBe('FOGRA51');

    const text = serialize(dict);
    expect(text).toContain('/S /GTS_PDFX');
    expect(text).toContain('(FOGRA51)');
  });

  it('omits optional entries when not supplied', () => {
    const dict = buildPdfX6OutputIntent({
      outputConditionIdentifier: 'Custom',
    });
    expect(dict.has('/OutputCondition')).toBe(false);
    expect(dict.has('/RegistryName')).toBe(false);
  });

  it('includes optional output condition and registry name when supplied', () => {
    const dict = buildPdfX6OutputIntent({
      variant: 'PDF/X-6p',
      outputConditionIdentifier: 'FOGRA51',
      outputCondition: 'Coated FOGRA51 (PSO Coated v3)',
      registryName: 'http://www.color.org',
    });

    const cond = dict.get('/OutputCondition');
    expect(cond).toBeInstanceOf(PdfString);
    expect((cond as PdfString).value).toBe('Coated FOGRA51 (PSO Coated v3)');

    const registry = dict.get('/RegistryName');
    expect(registry).toBeInstanceOf(PdfString);
    expect((registry as PdfString).value).toBe('http://www.color.org');
  });
});

describe('buildGtsPdfxVersion', () => {
  it('defaults to PDF/X-6', () => {
    expect(buildGtsPdfxVersion()).toBe('PDF/X-6');
    expect(buildGtsPdfxVersion(undefined)).toBe('PDF/X-6');
  });

  it('returns each variant verbatim', () => {
    const variants: PdfX6Variant[] = ['PDF/X-6', 'PDF/X-6p', 'PDF/X-6n'];
    for (const v of variants) {
      expect(buildGtsPdfxVersion(v)).toBe(v);
    }
  });
});

describe('validateBoxGeometry', () => {
  const mediaBox = [0, 0, 595, 842] as const;

  it('returns [] for a valid nested box set', () => {
    const box: BoxGeometry = {
      mediaBox,
      bleedBox: [5, 5, 590, 837],
      trimBox: [20, 20, 575, 822],
    };
    expect(validateBoxGeometry(box)).toEqual([]);
  });

  it('returns [] for a valid MediaBox + TrimBox without a BleedBox', () => {
    const box: BoxGeometry = {
      mediaBox,
      trimBox: [10, 10, 585, 832],
    };
    expect(validateBoxGeometry(box)).toEqual([]);
  });

  it('flags a missing TrimBox', () => {
    const errors = validateBoxGeometry({ mediaBox });
    expect(errors.some((e) => /TrimBox is required/.test(e))).toBe(true);
  });

  it('flags a TrimBox outside the MediaBox', () => {
    const box: BoxGeometry = {
      mediaBox,
      trimBox: [10, 10, 700, 832],
    };
    const errors = validateBoxGeometry(box);
    expect(errors.some((e) => /TrimBox must be within the MediaBox/.test(e))).toBe(
      true,
    );
  });

  it('flags a BleedBox outside the MediaBox', () => {
    const box: BoxGeometry = {
      mediaBox,
      bleedBox: [-10, -10, 590, 837],
      trimBox: [20, 20, 575, 822],
    };
    const errors = validateBoxGeometry(box);
    expect(
      errors.some((e) => /BleedBox must be within the MediaBox/.test(e)),
    ).toBe(true);
  });

  it('flags a TrimBox not within the BleedBox', () => {
    const box: BoxGeometry = {
      mediaBox,
      bleedBox: [100, 100, 200, 200],
      trimBox: [20, 20, 575, 822],
    };
    const errors = validateBoxGeometry(box);
    expect(
      errors.some((e) => /TrimBox must be within the BleedBox/.test(e)),
    ).toBe(true);
  });

  it('flags an invalid (zero-area) MediaBox and short-circuits', () => {
    const errors = validateBoxGeometry({ mediaBox: [0, 0, 0, 0] });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/MediaBox is required/);
  });

  it('flags a degenerate TrimBox rectangle', () => {
    const box: BoxGeometry = {
      mediaBox,
      trimBox: [50, 50, 50, 100],
    };
    const errors = validateBoxGeometry(box);
    expect(
      errors.some((e) => /TrimBox must be a positive-area rectangle/.test(e)),
    ).toBe(true);
  });
});

describe('buildBoxDict', () => {
  it('encodes all supplied boxes as four-number arrays', () => {
    const dict = buildBoxDict({
      mediaBox: [0, 0, 595, 842],
      bleedBox: [5, 5, 590, 837],
      trimBox: [20, 20, 575, 822],
    });

    const media = dict.get('/MediaBox');
    expect(media).toBeInstanceOf(PdfArray);
    const items = (media as PdfArray).items;
    expect(items).toHaveLength(4);
    expect(items.every((i) => i instanceof PdfNumber)).toBe(true);
    expect((items[2] as PdfNumber).value).toBe(595);

    expect(dict.has('/TrimBox')).toBe(true);
    expect(dict.has('/BleedBox')).toBe(true);
  });

  it('omits TrimBox/BleedBox when not provided', () => {
    const dict = buildBoxDict({ mediaBox: [0, 0, 100, 100] });
    expect(dict.has('/MediaBox')).toBe(true);
    expect(dict.has('/TrimBox')).toBe(false);
    expect(dict.has('/BleedBox')).toBe(false);
  });
});
