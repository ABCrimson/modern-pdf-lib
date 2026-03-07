/**
 * Tests for PDF/A profile definitions.
 *
 * Validates that each PDF/A conformance level (1a, 1b, 2a, 2b, 2u, 3a, 3b, 3u)
 * has the correct capability flags according to ISO 19005-1/2/3.
 */

import { describe, it, expect } from 'vitest';
import { getProfile, getSupportedLevels, isValidLevel } from '../../src/compliance/pdfAProfiles.js';
import type { PdfAProfile } from '../../src/compliance/pdfAProfiles.js';

describe('PDF/A profile definitions', () => {
  // -----------------------------------------------------------------------
  // getProfile — basic retrieval
  // -----------------------------------------------------------------------

  it('getProfile returns correct profile for 1b', () => {
    const p = getProfile('1b');
    expect(p.part).toBe(1);
    expect(p.conformance).toBe('b');
    expect(p.pdfVersion).toBe('1.4');
  });

  it('getProfile returns correct profile for 2b', () => {
    const p = getProfile('2b');
    expect(p.part).toBe(2);
    expect(p.conformance).toBe('b');
    expect(p.pdfVersion).toBe('1.7');
  });

  it('getProfile returns correct profile for 3b', () => {
    const p = getProfile('3b');
    expect(p.part).toBe(3);
    expect(p.conformance).toBe('b');
    expect(p.pdfVersion).toBe('1.7');
  });

  // -----------------------------------------------------------------------
  // Transparency rules
  // -----------------------------------------------------------------------

  it('PDF/A-1b disallows transparency', () => {
    expect(getProfile('1b').allowsTransparency).toBe(false);
  });

  it('PDF/A-2b allows transparency', () => {
    expect(getProfile('2b').allowsTransparency).toBe(true);
  });

  it('PDF/A-3b allows transparency', () => {
    expect(getProfile('3b').allowsTransparency).toBe(true);
  });

  // -----------------------------------------------------------------------
  // JPEG2000 rules
  // -----------------------------------------------------------------------

  it('PDF/A-1b disallows JPEG2000', () => {
    expect(getProfile('1b').allowsJpeg2000).toBe(false);
  });

  it('PDF/A-2b allows JPEG2000', () => {
    expect(getProfile('2b').allowsJpeg2000).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Embedded files rules
  // -----------------------------------------------------------------------

  it('PDF/A-1b disallows embedded files', () => {
    expect(getProfile('1b').allowsEmbeddedFiles).toBe(false);
  });

  it('PDF/A-3b allows embedded files', () => {
    expect(getProfile('3b').allowsEmbeddedFiles).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Structure tree (tagged PDF) requirements
  // -----------------------------------------------------------------------

  it('PDF/A-1a requires structure tree', () => {
    expect(getProfile('1a').requiresStructureTree).toBe(true);
  });

  it('PDF/A-1b does not require structure tree', () => {
    expect(getProfile('1b').requiresStructureTree).toBe(false);
  });

  // -----------------------------------------------------------------------
  // ToUnicode requirements
  // -----------------------------------------------------------------------

  it('PDF/A-2u requires ToUnicode', () => {
    expect(getProfile('2u').requiresToUnicode).toBe(true);
  });

  it('PDF/A-2b does not require ToUnicode', () => {
    expect(getProfile('2b').requiresToUnicode).toBe(false);
  });

  // -----------------------------------------------------------------------
  // getSupportedLevels
  // -----------------------------------------------------------------------

  it('getSupportedLevels returns all 8 levels', () => {
    const levels = getSupportedLevels();
    expect(levels).toHaveLength(8);
    expect(levels).toContain('1a');
    expect(levels).toContain('1b');
    expect(levels).toContain('2a');
    expect(levels).toContain('2b');
    expect(levels).toContain('2u');
    expect(levels).toContain('3a');
    expect(levels).toContain('3b');
    expect(levels).toContain('3u');
  });

  // -----------------------------------------------------------------------
  // isValidLevel
  // -----------------------------------------------------------------------

  it('isValidLevel returns true for valid levels', () => {
    expect(isValidLevel('1a')).toBe(true);
    expect(isValidLevel('1b')).toBe(true);
    expect(isValidLevel('2a')).toBe(true);
    expect(isValidLevel('2b')).toBe(true);
    expect(isValidLevel('2u')).toBe(true);
    expect(isValidLevel('3a')).toBe(true);
    expect(isValidLevel('3b')).toBe(true);
    expect(isValidLevel('3u')).toBe(true);
  });

  it('isValidLevel returns false for invalid levels', () => {
    expect(isValidLevel('4b')).toBe(false);
    expect(isValidLevel('1c')).toBe(false);
    expect(isValidLevel('')).toBe(false);
    expect(isValidLevel('abc')).toBe(false);
    expect(isValidLevel('0a')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // PDF version consistency
  // -----------------------------------------------------------------------

  it('all PDF/A-1 profiles have PDF version 1.4', () => {
    expect(getProfile('1a').pdfVersion).toBe('1.4');
    expect(getProfile('1b').pdfVersion).toBe('1.4');
  });

  it('all PDF/A-2 and PDF/A-3 profiles have PDF version 1.7', () => {
    for (const level of ['2a', '2b', '2u', '3a', '3b', '3u'] as const) {
      expect(getProfile(level).pdfVersion).toBe('1.7');
    }
  });

  // -----------------------------------------------------------------------
  // Output intent subtype consistency
  // -----------------------------------------------------------------------

  it('all profiles have correct output intent subtype', () => {
    for (const level of getSupportedLevels()) {
      expect(getProfile(level).outputIntentSubtype).toBe('/GTS_PDFA1');
    }
  });
});
