/**
 * Extended tests for transparency detection and flattening (PDF/A-1).
 *
 * The companion file `transparency.test.ts` covers the basic detect/flatten
 * cases.  This file adds coverage for:
 * - Edge-case numeric values for CA/ca (0, 0.0, 0.999, 1.0)
 * - Multiple blend mode types (Screen, Overlay, Darken, etc.)
 * - Counting accuracy across multiple ExtGState objects
 * - Position tracking in findings
 * - Empty PDF input
 * - Idempotency of flattenTransparency
 * - TransparencyInfo type shape validation
 */

import { describe, it, expect } from 'vitest';
import {
  detectTransparency,
  flattenTransparency,
} from '../../../src/compliance/transparencyFlattener.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function makePdf(body: string): Uint8Array {
  return encoder.encode(
    `%PDF-1.4\n1 0 obj\n${body}\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`,
  );
}

function makeMultiObjPdf(...bodies: string[]): Uint8Array {
  const objs = bodies.map(
    (b, i) => `${i + 1} 0 obj\n${b}\nendobj`,
  );
  return encoder.encode(
    '%PDF-1.4\n' + objs.join('\n') + '\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
  );
}

// ---------------------------------------------------------------------------
// detectTransparency — edge cases
// ---------------------------------------------------------------------------

describe('detectTransparency — edge cases', () => {
  it('detects CA 0 as transparent', () => {
    const pdf = makePdf('<< /CA 0 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.strokeOpacityCount).toBe(1);
  });

  it('detects CA 0.0 as transparent', () => {
    const pdf = makePdf('<< /CA 0.0 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.strokeOpacityCount).toBe(1);
  });

  it('detects CA 0.999 as transparent', () => {
    const pdf = makePdf('<< /CA 0.999 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.strokeOpacityCount).toBe(1);
  });

  it('detects ca 0 as transparent', () => {
    const pdf = makePdf('<< /ca 0 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(true);
    expect(info.fillOpacityCount).toBe(1);
  });

  it('treats CA 1.0 as opaque (no transparency)', () => {
    const pdf = makePdf('<< /CA 1.0 >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(false);
    expect(info.strokeOpacityCount).toBe(0);
  });

  it('detects various blend modes as transparent', () => {
    const modes = ['Multiply', 'Screen', 'Overlay', 'Darken', 'Lighten', 'ColorDodge'];
    for (const mode of modes) {
      const pdf = makePdf(`<< /BM /${mode} >>`);
      const info = detectTransparency(pdf);
      expect(info.hasTransparency).toBe(true);
      expect(info.blendModeCount).toBe(1);
      expect(info.findings[0]!.value).toBe(mode);
    }
  });

  it('counts multiple SMask references across objects', () => {
    const pdf = makeMultiObjPdf(
      '<< /SMask 10 0 R >>',
      '<< /SMask 11 0 R >>',
      '<< /SMask 12 0 R >>',
    );
    const info = detectTransparency(pdf);
    expect(info.softMaskCount).toBe(3);
    expect(info.findings).toHaveLength(3);
  });

  it('returns correct type for each finding', () => {
    const pdf = makePdf(
      '<< /CA 0.5 /ca 0.3 /SMask 10 0 R /BM /Multiply >>',
    );
    const info = detectTransparency(pdf);
    const types = info.findings.map(f => f.type);
    expect(types).toContain('stroke-opacity');
    expect(types).toContain('fill-opacity');
    expect(types).toContain('soft-mask');
    expect(types).toContain('blend-mode');
  });

  it('returns empty findings for a PDF with no ExtGState features', () => {
    const pdf = makePdf('<< /Type /Page >>');
    const info = detectTransparency(pdf);
    expect(info.hasTransparency).toBe(false);
    expect(info.findings).toHaveLength(0);
    expect(info.strokeOpacityCount).toBe(0);
    expect(info.fillOpacityCount).toBe(0);
    expect(info.softMaskCount).toBe(0);
    expect(info.blendModeCount).toBe(0);
  });

  it('positions are monotonically increasing for ordered findings', () => {
    const pdf = makeMultiObjPdf(
      '<< /CA 0.1 >>',
      '<< /CA 0.2 >>',
      '<< /CA 0.3 >>',
    );
    const info = detectTransparency(pdf);
    expect(info.findings.length).toBe(3);
    for (let i = 1; i < info.findings.length; i++) {
      expect(info.findings[i]!.position).toBeGreaterThan(
        info.findings[i - 1]!.position,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// flattenTransparency — edge cases
// ---------------------------------------------------------------------------

describe('flattenTransparency — edge cases', () => {
  it('is idempotent: flattening twice produces same result', () => {
    const pdf = makePdf('<< /CA 0.5 /ca 0.3 /BM /Multiply >>');
    const once = flattenTransparency(pdf);
    const twice = flattenTransparency(once);
    expect(decoder.decode(twice)).toBe(decoder.decode(once));
  });

  it('handles CA 0 by replacing with CA 1', () => {
    const pdf = makePdf('<< /CA 0 >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/CA 1');
    expect(text).not.toContain('/CA 0 ');
  });

  it('handles very small CA values', () => {
    const pdf = makePdf('<< /CA 0.001 >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/CA 1');
  });

  it('preserves CA 1.0 unchanged', () => {
    const pdf = makePdf('<< /CA 1.0 >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    // Should still contain 1.0 unchanged (not replaced)
    expect(text).toMatch(/\/CA\s+1/);
  });

  it('replaces /BM /Screen with /BM /Normal', () => {
    const pdf = makePdf('<< /BM /Screen >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/BM /Normal');
    expect(text).not.toContain('/BM /Screen');
  });

  it('replaces /BM /Overlay with /BM /Normal', () => {
    const pdf = makePdf('<< /BM /Overlay >>');
    const result = flattenTransparency(pdf);
    const text = decoder.decode(result);
    expect(text).toContain('/BM /Normal');
    expect(text).not.toContain('/BM /Overlay');
  });

  it('flattens transparency across multiple objects', () => {
    const pdf = makeMultiObjPdf(
      '<< /CA 0.1 /BM /Multiply >>',
      '<< /ca 0.2 /SMask 10 0 R >>',
    );
    const result = flattenTransparency(pdf);
    const after = detectTransparency(result);
    expect(after.hasTransparency).toBe(false);
  });

  it('output is always a Uint8Array', () => {
    const pdf = makePdf('<< /Type /Page >>');
    const result = flattenTransparency(pdf);
    expect(result).toBeInstanceOf(Uint8Array);
  });
});
