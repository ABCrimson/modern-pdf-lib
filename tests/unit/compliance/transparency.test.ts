/**
 * Tests for transparency detection and flattening (PDF/A-1 compliance).
 *
 * Covers:
 * - detectTransparency: no transparency in clean PDF
 * - detectTransparency: stroke opacity (CA < 1)
 * - detectTransparency: fill opacity (ca < 1)
 * - detectTransparency: soft masks (/SMask)
 * - detectTransparency: blend modes (/BM /Multiply)
 * - detectTransparency: ignores /CA 1 (fully opaque)
 * - detectTransparency: ignores /ca 1 (fully opaque)
 * - detectTransparency: ignores /SMask /None
 * - detectTransparency: ignores /BM /Normal
 * - flattenTransparency: replaces CA < 1 with CA 1
 * - flattenTransparency: replaces ca < 1 with ca 1
 * - flattenTransparency: replaces SMask with /None
 * - flattenTransparency: replaces blend modes with /Normal
 * - flattenTransparency: preserves non-transparency content
 * - Integration: detectTransparency reports clean after flatten
 */

import { describe, it, expect } from 'vitest';
import {
  detectTransparency,
  flattenTransparency,
} from '../../../src/compliance/transparencyFlattener.js';
import type {
  TransparencyInfo,
  TransparencyFinding,
} from '../../../src/compliance/transparencyFlattener.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Build a minimal PDF fragment with specific transparency features. */
function makePdf(body: string): Uint8Array {
  return encoder.encode(
    `%PDF-1.4\n1 0 obj\n${body}\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`,
  );
}

// ---------------------------------------------------------------------------
// detectTransparency
// ---------------------------------------------------------------------------

describe('detectTransparency', () => {
  it('finds no transparency in a clean PDF', () => {
    const pdf = makePdf('<< /Type /ExtGState /CA 1 /ca 1 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(false);
    expect(info.strokeOpacityCount).toBe(0);
    expect(info.fillOpacityCount).toBe(0);
    expect(info.softMaskCount).toBe(0);
    expect(info.blendModeCount).toBe(0);
    expect(info.findings).toHaveLength(0);
  });

  it('detects stroke opacity (CA < 1)', () => {
    const pdf = makePdf('<< /Type /ExtGState /CA 0.5 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.strokeOpacityCount).toBe(1);
    expect(info.findings[0]!.type).toBe('stroke-opacity');
    expect(info.findings[0]!.value).toBe('0.5');
  });

  it('detects fill opacity (ca < 1)', () => {
    const pdf = makePdf('<< /Type /ExtGState /ca 0.3 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.fillOpacityCount).toBe(1);
    expect(info.findings[0]!.type).toBe('fill-opacity');
    expect(info.findings[0]!.value).toBe('0.3');
  });

  it('detects soft masks (/SMask)', () => {
    const pdf = makePdf('<< /Type /ExtGState /SMask << /S /Luminosity >> >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.softMaskCount).toBe(1);
    expect(info.findings[0]!.type).toBe('soft-mask');
  });

  it('detects blend modes (/BM /Multiply)', () => {
    const pdf = makePdf('<< /Type /ExtGState /BM /Multiply >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.blendModeCount).toBe(1);
    expect(info.findings[0]!.type).toBe('blend-mode');
    expect(info.findings[0]!.value).toBe('Multiply');
  });

  it('ignores /CA 1 (fully opaque)', () => {
    const pdf = makePdf('<< /Type /ExtGState /CA 1 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(false);
    expect(info.strokeOpacityCount).toBe(0);
  });

  it('ignores /ca 1 (fully opaque)', () => {
    const pdf = makePdf('<< /Type /ExtGState /ca 1 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(false);
    expect(info.fillOpacityCount).toBe(0);
  });

  it('ignores /SMask /None', () => {
    const pdf = makePdf('<< /Type /ExtGState /SMask /None >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(false);
    expect(info.softMaskCount).toBe(0);
  });

  it('ignores /BM /Normal', () => {
    const pdf = makePdf('<< /Type /ExtGState /BM /Normal >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(false);
    expect(info.blendModeCount).toBe(0);
  });

  it('detects multiple transparency features at once', () => {
    const pdf = makePdf(
      '<< /Type /ExtGState /CA 0.5 /ca 0.7 /SMask << /S /Alpha >> /BM /Screen >>',
    );
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.strokeOpacityCount).toBe(1);
    expect(info.fillOpacityCount).toBe(1);
    expect(info.softMaskCount).toBe(1);
    expect(info.blendModeCount).toBe(1);
    expect(info.findings).toHaveLength(4);
  });

  it('reports correct positions for findings', () => {
    const pdf = makePdf('<< /CA 0.2 >>');
    const info = detectTransparency(pdf);
    expect(info.findings).toHaveLength(1);
    expect(typeof info.findings[0]!.position).toBe('number');
    expect(info.findings[0]!.position).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// flattenTransparency
// ---------------------------------------------------------------------------

describe('flattenTransparency', () => {
  it('replaces CA < 1 with CA 1', () => {
    const pdf = makePdf('<< /Type /ExtGState /CA 0.5 >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/CA 1');
    expect(text).not.toContain('/CA 0.5');
  });

  it('replaces ca < 1 with ca 1', () => {
    const pdf = makePdf('<< /Type /ExtGState /ca 0.3 >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/ca 1');
    expect(text).not.toContain('/ca 0.3');
  });

  it('replaces SMask with /None', () => {
    const pdf = makePdf('<< /Type /ExtGState /SMask << /S /Luminosity >> >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/SMask /None');
  });

  it('replaces blend modes with /Normal', () => {
    const pdf = makePdf('<< /Type /ExtGState /BM /Multiply >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/BM /Normal');
    expect(text).not.toContain('/BM /Multiply');
  });

  it('preserves non-transparency content', () => {
    const body = '<< /Type /Page /MediaBox [0 0 612 792] /Contents 2 0 R >>';
    const pdf = makePdf(body);
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/Type /Page');
    expect(text).toContain('/MediaBox [0 0 612 792]');
    expect(text).toContain('/Contents 2 0 R');
  });

  it('preserves /CA 1 (already opaque)', () => {
    const pdf = makePdf('<< /Type /ExtGState /CA 1 >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/CA 1');
  });

  it('preserves /ca 1 (already opaque)', () => {
    const pdf = makePdf('<< /Type /ExtGState /ca 1 >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/ca 1');
  });

  it('preserves /SMask /None', () => {
    const pdf = makePdf('<< /Type /ExtGState /SMask /None >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/SMask /None');
  });

  it('preserves /BM /Normal', () => {
    const pdf = makePdf('<< /Type /ExtGState /BM /Normal >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/BM /Normal');
  });
});

// ---------------------------------------------------------------------------
// Integration: detect after flatten
// ---------------------------------------------------------------------------

describe('integration: detect + flatten', () => {
  it('detectTransparency reports clean after flattenTransparency', () => {
    const pdf = makePdf(
      '<< /Type /ExtGState /CA 0.5 /ca 0.3 /SMask << /S /Luminosity >> /BM /Multiply >>',
    );

    // Verify transparency is detected before flattening
    const before = detectTransparency(pdf);
    expect(before.hasTransparency).toBe(true);
    expect(before.findings.length).toBeGreaterThan(0);

    // Flatten
    const flattened = flattenTransparency(pdf);

    // Verify transparency is gone after flattening
    const after = detectTransparency(flattened);
    expect(after.hasTransparency).toBe(false);
    expect(after.strokeOpacityCount).toBe(0);
    expect(after.fillOpacityCount).toBe(0);
    expect(after.softMaskCount).toBe(0);
    expect(after.blendModeCount).toBe(0);
    expect(after.findings).toHaveLength(0);
  });

  it('returns Uint8Array from flattenTransparency', () => {
    const pdf = makePdf('<< /CA 0.5 >>');
    const result = flattenTransparency(pdf);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('flattens multiple CA/ca values in the same document', () => {
    const pdf = encoder.encode(
      '%PDF-1.4\n' +
      '1 0 obj\n<< /Type /ExtGState /CA 0.5 /ca 0.2 >>\nendobj\n' +
      '2 0 obj\n<< /Type /ExtGState /CA 0.8 /ca 0.9 >>\nendobj\n' +
      'trailer\n<< /Root 1 0 R >>\n%%EOF\n',
    );

    const before = detectTransparency(pdf);
    expect(before.strokeOpacityCount).toBe(2);
    expect(before.fillOpacityCount).toBe(2);

    const flattened = flattenTransparency(pdf);
    const after = detectTransparency(flattened);
    expect(after.hasTransparency).toBe(false);
    expect(after.strokeOpacityCount).toBe(0);
    expect(after.fillOpacityCount).toBe(0);
  });
});
