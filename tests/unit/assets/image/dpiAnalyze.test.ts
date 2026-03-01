/**
 * Tests for DPI analysis and target dimension computation.
 *
 * Covers computeImageDpi() and computeTargetDimensions() from
 * the dpiAnalyze module.
 */

import { describe, it, expect } from 'vitest';
import {
  computeImageDpi,
  computeTargetDimensions,
} from '../../../../src/assets/image/dpiAnalyze.js';

// ---------------------------------------------------------------------------
// computeImageDpi
// ---------------------------------------------------------------------------

describe('computeImageDpi', () => {
  it('computes 72 DPI for 1:1 pixel-to-point ratio', () => {
    // 72 pixels displayed at 72 points = 1 inch = 72 DPI
    const dpi = computeImageDpi(72, 72, 72, 72);
    expect(dpi.xDpi).toBe(72);
    expect(dpi.yDpi).toBe(72);
    expect(dpi.effectiveDpi).toBe(72);
  });

  it('computes 300 DPI for high-res image', () => {
    // 300 pixels / (72 points / 72) = 300 DPI
    const dpi = computeImageDpi(300, 300, 72, 72);
    expect(dpi.xDpi).toBeCloseTo(300, 0);
    expect(dpi.yDpi).toBeCloseTo(300, 0);
    expect(dpi.effectiveDpi).toBeCloseTo(300, 0);
  });

  it('computes different x and y DPI', () => {
    // 600 pixels wide / (72 pts / 72) = 600 DPI horizontal
    // 300 pixels tall / (72 pts / 72) = 300 DPI vertical
    const dpi = computeImageDpi(600, 300, 72, 72);
    expect(dpi.xDpi).toBeCloseTo(600, 0);
    expect(dpi.yDpi).toBeCloseTo(300, 0);
    expect(dpi.effectiveDpi).toBeCloseTo(300, 0); // minimum
  });

  it('handles non-square display dimensions', () => {
    // 3000x2000 image at 300x200 points
    // xDpi = 3000 / (300 / 72) = 720
    // yDpi = 2000 / (200 / 72) = 720
    const dpi = computeImageDpi(3000, 2000, 300, 200);
    expect(dpi.xDpi).toBeCloseTo(720, 0);
    expect(dpi.yDpi).toBeCloseTo(720, 0);
    expect(dpi.effectiveDpi).toBeCloseTo(720, 0);
  });

  it('returns Infinity when display width is 0', () => {
    const dpi = computeImageDpi(100, 100, 0, 72);
    expect(dpi.xDpi).toBe(Infinity);
    expect(dpi.yDpi).toBeCloseTo(100, 0);
    expect(dpi.effectiveDpi).toBeCloseTo(100, 0);
  });

  it('returns Infinity when display height is 0', () => {
    const dpi = computeImageDpi(100, 100, 72, 0);
    expect(dpi.xDpi).toBeCloseTo(100, 0);
    expect(dpi.yDpi).toBe(Infinity);
    expect(dpi.effectiveDpi).toBeCloseTo(100, 0);
  });

  it('computes 150 DPI for typical screen resolution', () => {
    // 150 pixels / (72 pts / 72) = 150 DPI
    const dpi = computeImageDpi(150, 150, 72, 72);
    expect(dpi.effectiveDpi).toBeCloseTo(150, 0);
  });

  it('handles tiny display size (stamp-sized)', () => {
    // 1000x1000 image at 10x10 points (tiny display)
    // DPI = 1000 / (10 / 72) = 7200
    const dpi = computeImageDpi(1000, 1000, 10, 10);
    expect(dpi.effectiveDpi).toBeCloseTo(7200, 0);
  });
});

// ---------------------------------------------------------------------------
// computeTargetDimensions
// ---------------------------------------------------------------------------

describe('computeTargetDimensions', () => {
  it('does not downscale when below max DPI', () => {
    // 100 DPI image, max DPI is 150
    const result = computeTargetDimensions(100, 100, 72, 72, 150);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.downscaled).toBe(false);
  });

  it('does not downscale when at exactly max DPI', () => {
    // 150 DPI image, max DPI is 150
    const result = computeTargetDimensions(150, 150, 72, 72, 150);
    expect(result.width).toBe(150);
    expect(result.height).toBe(150);
    expect(result.downscaled).toBe(false);
  });

  it('downscales when exceeding max DPI', () => {
    // 300 DPI image, max DPI is 150
    // Scale factor = 150 / 300 = 0.5
    const result = computeTargetDimensions(300, 300, 72, 72, 150);
    expect(result.width).toBe(150);
    expect(result.height).toBe(150);
    expect(result.downscaled).toBe(true);
  });

  it('maintains proportional scaling', () => {
    // 600x400 image at 72x72 pts → effective DPI: min(600, 400) = 400
    // With max 150 DPI: scale = 150/400 = 0.375
    const result = computeTargetDimensions(600, 400, 72, 72, 150);
    expect(result.downscaled).toBe(true);
    // Both dimensions scaled by 150/400
    expect(result.width).toBe(Math.round(600 * (150 / 400)));
    expect(result.height).toBe(Math.round(400 * (150 / 400)));
  });

  it('ensures minimum dimension of 1', () => {
    // Very large image displayed very small, would produce < 1 pixel
    // 1000x1000 at 72x72 pts → ~1000 DPI, scale to maxDpi=1 → ~0.001x
    const result = computeTargetDimensions(1000, 1000, 72, 72, 1);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
    expect(result.downscaled).toBe(true);
  });

  it('does not downscale when display size is 0 (Infinity DPI)', () => {
    const result = computeTargetDimensions(100, 100, 0, 0, 150);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.downscaled).toBe(false);
  });

  it('handles realistic scan: 2400x3300 at letter size (612x792), max 150 DPI', () => {
    // Letter = 612x792 pts (8.5"x11")
    // DPI = 2400 / (612/72) ≈ 282.4 (x), 3300 / (792/72) ≈ 300 (y)
    // effectiveDpi = min(282.4, 300) = 282.4
    // scale = 150 / 282.4 ≈ 0.531
    const result = computeTargetDimensions(2400, 3300, 612, 792, 150);
    expect(result.downscaled).toBe(true);
    expect(result.width).toBeLessThan(2400);
    expect(result.height).toBeLessThan(3300);
    // Should be roughly half size
    expect(result.width).toBeGreaterThan(1000);
    expect(result.height).toBeGreaterThan(1500);
  });
});
