/**
 * Tests for the document `/Requirements` API (ISO 32000-2 §7.12.7).
 *
 * Covers:
 * - buildRequirement: single requirement dict with /Type /Reqs and /S name
 * - buildRequirements: array length matches input
 * - Each entry's /S name matches the supplied requirement type
 * - All standard requirement types map to the correct /S name
 * - Empty input yields an empty array
 * - Duplicates are preserved in order
 * - Returned objects have the expected `kind` discriminants
 * - Serialized output is well-formed PDF
 */

import { describe, it, expect } from 'vitest';
import { buildRequirement, buildRequirements } from '../../../src/core/requirements.js';
import type { RequirementType } from '../../../src/core/requirements.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  type ByteWriter,
} from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ByteWriter that accumulates Latin-1/ASCII output into a string. */
class StringWriter implements ByteWriter {
  private chunks: string[] = [];

  write(data: Uint8Array): void {
    this.chunks.push(String.fromCharCode(...data));
  }

  writeString(str: string): void {
    this.chunks.push(str);
  }

  toString(): string {
    return this.chunks.join('');
  }
}

function serialize(obj: { serialize(writer: ByteWriter): void }): string {
  const writer = new StringWriter();
  obj.serialize(writer);
  return writer.toString();
}

/** Read the /S name value off a requirement dictionary as a plain string. */
function subtypeOf(dict: PdfDict): string {
  const s = dict.get('/S');
  expect(s).toBeInstanceOf(PdfName);
  // PdfName.value includes the leading '/'
  return (s as PdfName).value.slice(1);
}

const ALL_TYPES: readonly RequirementType[] = [
  'EnableJavaScripts',
  'Attachment',
  'AcroForm',
  'Navigation',
  'Markup',
  'Encryption',
  'DigSigValidation',
];

// ---------------------------------------------------------------------------
// buildRequirement
// ---------------------------------------------------------------------------

describe('buildRequirement', () => {
  it('produces a dictionary with /Type /Reqs', () => {
    const dict = buildRequirement('EnableJavaScripts');
    expect(dict).toBeInstanceOf(PdfDict);

    const type = dict.get('/Type');
    expect(type).toBeInstanceOf(PdfName);
    expect((type as PdfName).value).toBe('/Reqs');
  });

  it('sets /S to the supplied requirement type', () => {
    const dict = buildRequirement('Attachment');
    expect(subtypeOf(dict)).toBe('Attachment');
  });

  it('has exactly two entries (/Type and /S)', () => {
    const dict = buildRequirement('AcroForm');
    expect(dict.size).toBe(2);
    expect(dict.has('/Type')).toBe(true);
    expect(dict.has('/S')).toBe(true);
  });

  it('maps every standard requirement type to the matching /S name', () => {
    for (const type of ALL_TYPES) {
      const dict = buildRequirement(type);
      expect(subtypeOf(dict)).toBe(type);
      expect((dict.get('/Type') as PdfName).value).toBe('/Reqs');
    }
  });

  it('serializes to well-formed PDF dictionary syntax', () => {
    const out = serialize(buildRequirement('Markup'));
    expect(out.startsWith('<<')).toBe(true);
    expect(out.endsWith('>>')).toBe(true);
    expect(out).toContain('/Type /Reqs');
    expect(out).toContain('/S /Markup');
  });
});

// ---------------------------------------------------------------------------
// buildRequirements
// ---------------------------------------------------------------------------

describe('buildRequirements', () => {
  it('returns a PdfArray', () => {
    const arr = buildRequirements(['EnableJavaScripts']);
    expect(arr).toBeInstanceOf(PdfArray);
  });

  it('builds an array whose length matches the input (spec scenario)', () => {
    const arr = buildRequirements(['EnableJavaScripts', 'Attachment']);
    expect(arr.length).toBe(2);
  });

  it('each entry is /Type Reqs and /S matches in order (spec scenario)', () => {
    const types: readonly RequirementType[] = ['EnableJavaScripts', 'Attachment'];
    const arr = buildRequirements(types);

    expect(arr.items).toHaveLength(types.length);
    arr.items.forEach((item, i) => {
      expect(item).toBeInstanceOf(PdfDict);
      const dict = item as PdfDict;
      expect((dict.get('/Type') as PdfName).value).toBe('/Reqs');
      expect(subtypeOf(dict)).toBe(types[i]);
    });
  });

  it('handles the full set of standard requirement types', () => {
    const arr = buildRequirements(ALL_TYPES);
    expect(arr.length).toBe(ALL_TYPES.length);
    arr.items.forEach((item, i) => {
      expect(subtypeOf(item as PdfDict)).toBe(ALL_TYPES[i]);
    });
  });

  it('returns an empty array for empty input', () => {
    const arr = buildRequirements([]);
    expect(arr).toBeInstanceOf(PdfArray);
    expect(arr.length).toBe(0);
  });

  it('preserves duplicate types in the supplied order', () => {
    const arr = buildRequirements(['AcroForm', 'AcroForm', 'Encryption']);
    expect(arr.length).toBe(3);
    expect(subtypeOf(arr.items[0] as PdfDict)).toBe('AcroForm');
    expect(subtypeOf(arr.items[1] as PdfDict)).toBe('AcroForm');
    expect(subtypeOf(arr.items[2] as PdfDict)).toBe('Encryption');
  });

  it('produces independent dictionary instances per entry', () => {
    const arr = buildRequirements(['Navigation', 'Navigation']);
    expect(arr.items[0]).not.toBe(arr.items[1]);
  });

  it('serializes to a PDF array of requirement dictionaries', () => {
    const out = serialize(buildRequirements(['EnableJavaScripts', 'DigSigValidation']));
    expect(out.startsWith('[')).toBe(true);
    expect(out.endsWith(']')).toBe(true);
    expect(out).toContain('/S /EnableJavaScripts');
    expect(out).toContain('/S /DigSigValidation');
    // Two requirement dictionaries present
    expect(out.match(/\/Type \/Reqs/g)).toHaveLength(2);
  });

  it('all entries carry the discriminating dict kind', () => {
    const arr = buildRequirements(ALL_TYPES);
    for (const item of arr.items) {
      expect(item.kind).toBe('dict');
    }
  });
});
