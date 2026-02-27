/**
 * Tests for SVG to PDF operator conversion.
 *
 * Covers:
 * - Basic shape rendering (rect, circle, ellipse)
 * - Path rendering
 * - Colour application
 * - Transform application
 * - Coordinate system flip (SVG top-down → PDF bottom-up)
 * - Page integration
 */

import { describe, it, expect } from 'vitest';
import { svgToPdfOperators, drawSvgOnPage } from '../../../src/assets/svg/svgToPdf.js';
import { parseSvg } from '../../../src/assets/svg/svgParser.js';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

describe('svgToPdfOperators', () => {
  it('should produce save/restore state for root SVG', () => {
    const el = parseSvg('<svg width="100" height="100"></svg>');
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
  });

  it('should include a coordinate transform (cm operator)', () => {
    const el = parseSvg('<svg width="100" height="100"></svg>');
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('cm\n');
  });

  it('should render a rectangle', () => {
    const el = parseSvg('<svg width="200" height="200"><rect x="10" y="10" width="80" height="60" fill="red"/></svg>');
    const ops = svgToPdfOperators(el);
    // Should contain the rect operator
    expect(ops).toContain('re\n');
    // Should contain fill colour (red = 1 0 0 rg)
    expect(ops).toContain('1 0 0 rg\n');
    // Should contain fill operator
    expect(ops).toContain('f\n');
  });

  it('should render a circle', () => {
    const el = parseSvg('<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>');
    const ops = svgToPdfOperators(el);
    // Circle is rendered as 4 cubic Bezier curves + moveTo
    expect(ops).toContain('m\n');
    expect(ops).toContain('c\n');
    expect(ops).toContain('f\n');
    // Blue fill
    expect(ops).toContain('0 0 1 rg\n');
  });

  it('should render an ellipse', () => {
    const el = parseSvg('<svg width="100" height="100"><ellipse cx="50" cy="50" rx="40" ry="20" stroke="green" fill="none"/></svg>');
    const ops = svgToPdfOperators(el);
    // Should have stroke colour and stroke operator
    expect(ops).toContain('RG\n');
    expect(ops).toContain('S\n');
  });

  it('should render a path with fill and stroke', () => {
    const el = parseSvg('<svg width="100" height="100"><path d="M 0 0 L 100 100" fill="red" stroke="blue" stroke-width="2"/></svg>');
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('rg\n'); // fill colour
    expect(ops).toContain('RG\n'); // stroke colour
    expect(ops).toContain('2 w\n'); // stroke width
    expect(ops).toContain('B\n'); // fill and stroke
  });

  it('should apply transforms via cm operator', () => {
    const el = parseSvg('<svg width="100" height="100"><g transform="translate(10,20)"><rect x="0" y="0" width="10" height="10"/></g></svg>');
    const ops = svgToPdfOperators(el);
    // The group transform should produce a cm operator
    const cmCount = (ops.match(/cm\n/g) ?? []).length;
    expect(cmCount).toBeGreaterThanOrEqual(2); // root + group
  });

  it('should respect width/height options', () => {
    const el = parseSvg('<svg width="100" height="100"><rect x="0" y="0" width="100" height="100"/></svg>');
    const ops = svgToPdfOperators(el, { width: 200, height: 200 });
    // The scale factor should be 2 (200/100)
    expect(ops).toContain('2');
  });

  it('should respect x/y offset options', () => {
    const el = parseSvg('<svg width="100" height="100"></svg>');
    const ops = svgToPdfOperators(el, { x: 50, y: 50 });
    // The offset should appear in the transform
    expect(ops).toContain('50');
  });

  it('should skip defs and metadata elements', () => {
    const el = parseSvg('<svg width="100" height="100"><defs><rect/></defs><title>Test</title><rect x="0" y="0" width="10" height="10"/></svg>');
    const ops = svgToPdfOperators(el);
    // Should only render the visible rect, not the one inside defs
    const reCount = (ops.match(/re\n/g) ?? []).length;
    expect(reCount).toBe(1);
  });

  it('should handle viewBox', () => {
    const el = parseSvg('<svg width="200" height="200" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>');
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('cm\n');
    expect(ops).toContain('re\n');
  });
});

describe('drawSvgOnPage', () => {
  it('should append SVG operators to the page content stream', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    drawSvgOnPage(page, '<svg width="100" height="100"><rect x="0" y="0" width="100" height="100" fill="red"/></svg>');

    const content = page.getContentStreamData();
    expect(content).toContain('q\n');
    expect(content).toContain('re\n');
    expect(content).toContain('Q\n');
  });

  it('should accept render options', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    drawSvgOnPage(page, '<svg width="100" height="100"></svg>', { x: 50, y: 100, width: 200, height: 200 });

    const content = page.getContentStreamData();
    expect(content).toContain('cm\n');
  });
});
