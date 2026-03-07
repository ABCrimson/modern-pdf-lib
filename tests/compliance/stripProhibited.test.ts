/**
 * Tests for stripProhibitedFeatures — stripping PDF/A prohibited features
 * (JavaScript, Launch, Sound, Movie, RichMedia) from raw PDF bytes.
 *
 * 14+ test cases covering:
 * - Individual feature stripping (JavaScript, Launch, Sound, Movie, RichMedia)
 * - No-op when nothing to strip
 * - Strip report correctness
 * - Selective options (disable individual categories)
 * - Empty input
 * - Content preservation
 * - Multiple JS actions
 * - countOccurrences helper
 * - Integration with validatePdfA
 */

import { describe, it, expect } from 'vitest';
import {
  stripProhibitedFeatures,
  countOccurrences,
} from '../../src/compliance/stripProhibited.js';
import { validatePdfA } from '../../src/compliance/pdfA.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Build a minimal synthetic PDF with the given body injected. */
function buildPdf(extraObjects: string = ''): Uint8Array {
  const lines = [
    '%PDF-1.7',
    '1 0 obj',
    '<< /Type /Catalog /Pages 2 0 R >>',
    'endobj',
    '2 0 obj',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    'endobj',
    '3 0 obj',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
    'endobj',
    extraObjects,
    'xref',
    '0 1',
    '0000000000 65535 f ',
    'trailer',
    '<< /Size 10 /Root 1 0 R /ID [<aabb> <ccdd>] >>',
    'startxref',
    '0',
    '%%EOF',
  ];
  return encoder.encode(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripProhibitedFeatures', () => {
  // 1. Strips /JavaScript actions
  it('strips /S /JavaScript action entries', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Action /S /JavaScript /JS (alert("hi")) >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/S /JavaScript');
    expect(text).not.toContain('/JS (alert');
    expect(result.stripped.some((s) => s.type === 'JavaScript')).toBe(true);
  });

  // 2. Strips /JS entries (hex-string variant)
  it('strips /JS hex-string entries', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Action /S /JavaScript /JS <616C657274> >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/JS <616C657274>');
  });

  // 3. Strips /Launch actions
  it('strips /S /Launch action entries', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Action /S /Launch /F (cmd.exe) >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/S /Launch');
    expect(result.stripped.some((s) => s.type === 'Launch')).toBe(true);
  });

  // 4. Strips /Sound actions
  it('strips /S /Sound action entries', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Action /S /Sound /Sound 5 0 R >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/S /Sound');
    expect(result.stripped.some((s) => s.type === 'Sound')).toBe(true);
  });

  // 5. Strips /Movie actions
  it('strips /S /Movie action entries', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Action /S /Movie /T (clip) >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/S /Movie');
    expect(result.stripped.some((s) => s.type === 'Movie')).toBe(true);
  });

  // 6. Strips /RichMedia
  it('strips /Subtype /RichMedia annotation entries', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Annot /Subtype /RichMedia >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/Subtype /RichMedia');
    expect(text).toContain('/Subtype /Link');
    expect(result.stripped.some((s) => s.type === 'RichMedia')).toBe(true);
  });

  // 7. Returns modified: false when nothing to strip
  it('returns modified: false when PDF has no prohibited features', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Annot /Subtype /Link /A << /S /URI /URI (https://example.com) >> >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(false);
    expect(result.stripped).toHaveLength(0);
    // bytes should be the same reference (no copy)
    expect(result.bytes).toBe(pdf);
  });

  // 8. Returns correct strip report
  it('returns accurate strip report with type and count', () => {
    const pdf = buildPdf([
      '4 0 obj\n<< /S /JavaScript /JS (a) >>\nendobj',
      '5 0 obj\n<< /S /Launch /F (x) >>\nendobj',
      '6 0 obj\n<< /Subtype /RichMedia >>\nendobj',
    ].join('\n'));
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    expect(result.stripped.length).toBeGreaterThanOrEqual(3);

    const jsEntry = result.stripped.find((s) => s.type === 'JavaScript');
    const launchEntry = result.stripped.find((s) => s.type === 'Launch');
    const richEntry = result.stripped.find((s) => s.type === 'RichMedia');
    expect(jsEntry).toBeDefined();
    expect(jsEntry!.count).toBeGreaterThanOrEqual(1);
    expect(launchEntry).toBeDefined();
    expect(launchEntry!.count).toBe(1);
    expect(richEntry).toBeDefined();
    expect(richEntry!.count).toBe(1);
  });

  // 9. Respects options (can disable individual stripping)
  it('respects stripJavaScript: false option', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /S /JavaScript /JS (code) >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf, { stripJavaScript: false });

    // JavaScript should NOT be stripped
    const text = decoder.decode(result.bytes);
    expect(text).toContain('/S /JavaScript');
    expect(result.stripped.some((s) => s.type === 'JavaScript')).toBe(false);
  });

  it('respects stripLaunch: false option', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /S /Launch /F (x) >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf, { stripLaunch: false });

    const text = decoder.decode(result.bytes);
    expect(text).toContain('/S /Launch');
    expect(result.stripped.some((s) => s.type === 'Launch')).toBe(false);
  });

  it('respects stripSound: false option', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /S /Sound /Sound 5 0 R >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf, { stripSound: false });

    const text = decoder.decode(result.bytes);
    expect(text).toContain('/S /Sound');
  });

  it('respects stripMovie: false option', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /S /Movie /T (clip) >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf, { stripMovie: false });

    const text = decoder.decode(result.bytes);
    expect(text).toContain('/S /Movie');
  });

  it('respects stripRichMedia: false option', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Subtype /RichMedia >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf, { stripRichMedia: false });

    const text = decoder.decode(result.bytes);
    expect(text).toContain('/Subtype /RichMedia');
  });

  // 10. Handles empty bytes
  it('handles empty Uint8Array gracefully', () => {
    const result = stripProhibitedFeatures(new Uint8Array(0));

    expect(result.modified).toBe(false);
    expect(result.stripped).toHaveLength(0);
    expect(result.bytes.length).toBe(0);
  });

  // 11. Preserves valid content
  it('preserves valid PDF content that is not prohibited', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Annot /Subtype /Link /A << /S /URI /URI (https://example.com) >> >>\nendobj',
    );
    const result = stripProhibitedFeatures(pdf);

    const text = decoder.decode(result.bytes);
    expect(text).toContain('/S /URI');
    expect(text).toContain('https://example.com');
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Page');
    expect(text).toContain('%PDF-1.7');
  });

  // 12. Handles multiple JS actions
  it('strips multiple JavaScript actions in the same document', () => {
    const pdf = buildPdf([
      '4 0 obj\n<< /S /JavaScript /JS (alert(1)) >>\nendobj',
      '5 0 obj\n<< /S /JavaScript /JS (alert(2)) >>\nendobj',
      '6 0 obj\n<< /S /JavaScript /JS <48656C6C6F> >>\nendobj',
    ].join('\n'));
    const result = stripProhibitedFeatures(pdf);

    expect(result.modified).toBe(true);
    const text = decoder.decode(result.bytes);
    expect(text).not.toContain('/S /JavaScript');
    expect(text).not.toContain('/JS (alert');
    expect(text).not.toContain('/JS <48656C6C6F>');

    const jsEntry = result.stripped.find((s) => s.type === 'JavaScript');
    expect(jsEntry).toBeDefined();
    // 3 /S /JavaScript + 2 literal /JS + 1 hex /JS = 6 total
    expect(jsEntry!.count).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// countOccurrences
// ---------------------------------------------------------------------------

describe('countOccurrences', () => {
  it('counts non-overlapping occurrences correctly', () => {
    expect(countOccurrences('abcabcabc', 'abc')).toBe(3);
    expect(countOccurrences('hello world', 'xyz')).toBe(0);
    expect(countOccurrences('aaa', 'aa')).toBe(1); // non-overlapping
    expect(countOccurrences('', 'x')).toBe(0);
    expect(countOccurrences('/JavaScript /JavaScript', '/JavaScript')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Integration: stripped PDF passes validatePdfA JavaScript check
// ---------------------------------------------------------------------------

describe('Integration: stripProhibitedFeatures + validatePdfA', () => {
  it('stripped PDF no longer has PDFA-004 JavaScript issue', () => {
    const pdf = buildPdf(
      '4 0 obj\n<< /Type /Action /S /JavaScript /JS (alert("hello")) >>\nendobj',
    );

    // Before stripping: should have JavaScript issue
    const beforeValidation = validatePdfA(pdf, '2b');
    const jsIssueBefore = beforeValidation.issues.find((i) => i.code === 'PDFA-004');
    expect(jsIssueBefore).toBeDefined();

    // Strip prohibited features
    const stripped = stripProhibitedFeatures(pdf);
    expect(stripped.modified).toBe(true);

    // After stripping: JavaScript issue should be gone
    const afterValidation = validatePdfA(stripped.bytes, '2b');
    const jsIssueAfter = afterValidation.issues.find((i) => i.code === 'PDFA-004');
    expect(jsIssueAfter).toBeUndefined();
  });
});
