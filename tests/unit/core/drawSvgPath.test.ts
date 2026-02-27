/**
 * Tests for PdfPage.drawSvgPath() -- drawing SVG path data directly on a page.
 */

import { describe, it, expect } from 'vitest';
import { PdfPage, PageSizes } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';
import { rgb } from '../../../src/core/operators/color.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(
  width?: number,
  height?: number,
): { page: PdfPage; registry: PdfObjectRegistry } {
  const registry = new PdfObjectRegistry();
  const [w, h] = [width ?? PageSizes.A4[0], height ?? PageSizes.A4[1]];
  const page = new PdfPage(w, h, registry);
  return { page, registry };
}

// ---------------------------------------------------------------------------
// Tests: basic path commands
// ---------------------------------------------------------------------------

describe('PdfPage.drawSvgPath()', () => {
  it('emits nothing for an empty path', () => {
    const { page } = makePage();
    page.drawSvgPath('');
    const ops = page.getContentStreamData();
    expect(ops).toBe('');
  });

  it('emits move and line operators for M/L/Z path', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 100 0 L 100 100 Z');
    const ops = page.getContentStreamData();

    // Should be wrapped in q/Q (save/restore)
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');

    // Should contain the path operators
    expect(ops).toContain('0 0 m\n');     // moveTo
    expect(ops).toContain('100 0 l\n');   // lineTo
    expect(ops).toContain('100 100 l\n'); // lineTo
    expect(ops).toContain('h\n');         // closePath

    // Default painting: fill
    expect(ops).toContain('f\n');
  });

  it('handles cubic bezier curves (C command)', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 C 10 20 30 40 50 60');
    const ops = page.getContentStreamData();

    expect(ops).toContain('0 0 m\n');
    expect(ops).toContain('10 20 30 40 50 60 c\n');
    expect(ops).toContain('f\n');
  });

  it('handles H and V commands', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 H 100 V 50');
    const ops = page.getContentStreamData();

    expect(ops).toContain('0 0 m\n');
    // H 100 -> lineTo(100, 0)
    expect(ops).toContain('100 0 l\n');
    // V 50 -> lineTo(100, 50)
    expect(ops).toContain('100 50 l\n');
  });

  it('handles quadratic bezier (Q command) converted to cubic', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 Q 50 50 100 0');
    const ops = page.getContentStreamData();

    expect(ops).toContain('0 0 m\n');
    // Q is converted to cubic C -- check there is a 'c' operator
    expect(ops).toMatch(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+ c/);
  });

  // -------------------------------------------------------------------------
  // Transform and position
  // -------------------------------------------------------------------------

  it('applies x/y translation via concatMatrix', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 10 10', { x: 50, y: 200 });
    const ops = page.getContentStreamData();

    // The transform should be: [scale, 0, 0, -scale, x, y]
    // Default scale = 1, so: 1 0 0 -1 50 200 cm
    expect(ops).toContain('1 0 0 -1 50 200 cm\n');
  });

  it('applies scale factor via concatMatrix', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 10 10', { scale: 2 });
    const ops = page.getContentStreamData();

    // scale=2: 2 0 0 -2 0 0 cm
    expect(ops).toContain('2 0 0 -2 0 0 cm\n');
  });

  it('applies both x/y and scale together', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 10 10', { x: 100, y: 300, scale: 0.5 });
    const ops = page.getContentStreamData();

    expect(ops).toContain('0.5 0 0 -0.5 100 300 cm\n');
  });

  // -------------------------------------------------------------------------
  // Colors
  // -------------------------------------------------------------------------

  it('applies fill color', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 100 0 L 100 100 Z', {
      color: rgb(1, 0, 0),
    });
    const ops = page.getContentStreamData();

    // RGB fill color
    expect(ops).toContain('1 0 0 rg\n');
    // Should fill (no stroke specified)
    expect(ops).toContain('f\n');
    // Should NOT contain stroke color or stroke operator
    expect(ops).not.toContain('RG\n');
  });

  it('applies stroke color and border width', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 100 0 L 100 100 Z', {
      borderColor: rgb(0, 0, 1),
      borderWidth: 3,
    });
    const ops = page.getContentStreamData();

    // Stroke color
    expect(ops).toContain('0 0 1 RG\n');
    // Line width
    expect(ops).toContain('3 w\n');
    // Should stroke only (no fill color specified)
    expect(ops).toContain('S\n');
  });

  it('applies both fill and stroke (fill-and-stroke operator B)', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 100 0 L 100 100 Z', {
      color: rgb(1, 0, 0),
      borderColor: rgb(0, 0, 1),
      borderWidth: 2,
    });
    const ops = page.getContentStreamData();

    expect(ops).toContain('1 0 0 rg\n');
    expect(ops).toContain('0 0 1 RG\n');
    expect(ops).toContain('2 w\n');
    // Fill and stroke
    expect(ops).toContain('B\n');
  });

  it('applies opacity via ExtGState', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 100 0 L 100 100 Z', { opacity: 0.5 });
    const ops = page.getContentStreamData();

    // Should reference a graphics state (GS1 or similar)
    expect(ops).toMatch(/\/GS\d+ gs\n/);
  });

  // -------------------------------------------------------------------------
  // Y-axis flip
  // -------------------------------------------------------------------------

  it('flips Y axis (negative Y scale in matrix)', () => {
    const { page } = makePage();
    page.drawSvgPath('M 0 0 L 10 10', { x: 0, y: 0 });
    const ops = page.getContentStreamData();

    // Matrix should have negative Y scale: [1, 0, 0, -1, 0, 0]
    expect(ops).toContain('1 0 0 -1 0 0 cm\n');
  });

  // -------------------------------------------------------------------------
  // Complex paths
  // -------------------------------------------------------------------------

  it('handles a triangle path', () => {
    const { page } = makePage();
    page.drawSvgPath('M 50 0 L 100 100 L 0 100 Z', {
      x: 10,
      y: 500,
      color: rgb(0, 0.5, 0),
    });
    const ops = page.getContentStreamData();

    expect(ops).toContain('50 0 m\n');
    expect(ops).toContain('100 100 l\n');
    expect(ops).toContain('0 100 l\n');
    expect(ops).toContain('h\n');
    expect(ops).toContain('f\n');
  });

  it('handles multiple sub-paths', () => {
    const { page } = makePage();
    // Two separate rectangles as sub-paths
    page.drawSvgPath('M 0 0 L 10 0 L 10 10 L 0 10 Z M 20 20 L 30 20 L 30 30 L 20 30 Z');
    const ops = page.getContentStreamData();

    // Should have two moveTo commands
    const moveMatches = ops.match(/\d+ \d+ m\n/g);
    expect(moveMatches).not.toBeNull();
    expect(moveMatches!.length).toBe(2);

    // Should have two closePath commands
    const closeMatches = ops.match(/h\n/g);
    expect(closeMatches).not.toBeNull();
    expect(closeMatches!.length).toBe(2);
  });

  it('handles relative commands (lowercase)', () => {
    const { page } = makePage();
    // m 10 10 l 20 0 l 0 20 z
    // -> moveTo(10,10) lineTo(30,10) lineTo(30,30) close
    page.drawSvgPath('m 10 10 l 20 0 l 0 20 z');
    const ops = page.getContentStreamData();

    expect(ops).toContain('10 10 m\n');
    expect(ops).toContain('30 10 l\n');
    expect(ops).toContain('30 30 l\n');
    expect(ops).toContain('h\n');
  });
});
