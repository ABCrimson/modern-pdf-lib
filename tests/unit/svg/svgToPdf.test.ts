/**
 * Tests for SVG to PDF operator conversion.
 *
 * Covers:
 * - Basic shape rendering (rect, circle, ellipse, line, polyline, polygon)
 * - Path rendering (M, L, C, Q, A, Z commands)
 * - Colour application (fill, stroke)
 * - Fill-rule (nonzero, evenodd)
 * - Stroke properties (linecap, linejoin, dasharray, miterlimit)
 * - Transform application (translate, scale, rotate, matrix)
 * - Text rendering (<text> elements with Tf/Tj operators)
 * - Coordinate system flip (SVG top-down -> PDF bottom-up)
 * - ViewBox scaling
 * - Nested groups
 * - Page integration
 * - Error handling (invalid / empty SVG)
 * - Complex real-world SVG snippet
 */

import { describe, it, expect } from 'vitest';
import { svgToPdfOperators, drawSvgOnPage } from '../../../src/assets/svg/svgToPdf.js';
import { parseSvg } from '../../../src/assets/svg/svgParser.js';
import { PdfPage } from '../../../src/core/pdfPage.js';
import { PdfObjectRegistry } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Basic shape rendering
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — basic shapes', () => {
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

  it('should render a rectangle with re operator', () => {
    const el = parseSvg(
      '<svg width="200" height="200"><rect x="10" y="10" width="80" height="60" fill="red"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('10 10 80 60 re\n');
    expect(ops).toContain('1 0 0 rg\n');
    expect(ops).toContain('f\n');
  });

  it('should render a circle as 4 cubic Bezier curves', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    // Circle is rendered as moveTo + 4 cubic curves
    expect(ops).toContain('m\n');
    const cCount = (ops.match(/c\n/g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(4);
    expect(ops).toContain('0 0 1 rg\n'); // Blue fill
    expect(ops).toContain('f\n');
  });

  it('should render an ellipse with stroke only', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><ellipse cx="50" cy="50" rx="40" ry="20" stroke="green" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('RG\n');
    expect(ops).toContain('S\n');
    // Should NOT have a fill operator (no 'f\n' without preceding fill colour)
    // Check that we get stroke, not fill-and-stroke
    expect(ops).not.toContain('B\n');
  });

  it('should render a line (moveTo + lineTo)', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><line x1="0" y1="0" x2="100" y2="100" stroke="black" stroke-width="2"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('0 0 m\n');
    expect(ops).toContain('100 100 l\n');
    expect(ops).toContain('2 w\n');
  });

  it('should render a polyline (series of line segments)', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><polyline points="0,0 50,50 100,0" stroke="red" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('0 0 m\n');
    expect(ops).toContain('50 50 l\n');
    expect(ops).toContain('100 0 l\n');
    expect(ops).toContain('S\n'); // Stroke only
  });

  it('should render a polygon (closed polyline)', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><polygon points="50,0 100,100 0,100" fill="yellow"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('50 0 m\n');
    expect(ops).toContain('100 100 l\n');
    expect(ops).toContain('0 100 l\n');
    expect(ops).toContain('h\n'); // closePath
    expect(ops).toContain('f\n'); // fill
  });
});

// ---------------------------------------------------------------------------
// Path rendering
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — paths', () => {
  it('should render a path with M L Z', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><path d="M 0 0 L 100 0 L 100 100 Z" fill="red"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('0 0 m\n');
    expect(ops).toContain('100 0 l\n');
    expect(ops).toContain('100 100 l\n');
    expect(ops).toContain('h\n');
    expect(ops).toContain('f\n');
  });

  it('should render a path with cubic Bezier (C)', () => {
    const el = parseSvg(
      '<svg width="200" height="200"><path d="M 0 0 C 50 100 150 100 200 0" stroke="blue" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('0 0 m\n');
    expect(ops).toContain('c\n'); // cubic Bezier
    expect(ops).toContain('S\n'); // stroke
  });

  it('should render a path with quadratic Bezier (Q) converted to cubic', () => {
    const el = parseSvg(
      '<svg width="200" height="200"><path d="M 0 0 Q 100 200 200 0" stroke="green" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('0 0 m\n');
    // Quadratic is converted to cubic — should see 'c' operator
    expect(ops).toContain('c\n');
    expect(ops).toContain('S\n');
  });

  it('should render a path with fill and stroke', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><path d="M 0 0 L 100 100" fill="red" stroke="blue" stroke-width="2"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('rg\n'); // fill colour
    expect(ops).toContain('RG\n'); // stroke colour
    expect(ops).toContain('2 w\n'); // stroke width
    expect(ops).toContain('B\n'); // fill and stroke
  });

  it('should render arc (A) commands as Bezier curves', () => {
    const el = parseSvg(
      '<svg width="300" height="300"><path d="M 10 80 A 45 45 0 0 0 125 125" stroke="black" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('m\n');
    expect(ops).toContain('c\n'); // Arc segments become Bezier curves
    expect(ops).toContain('S\n');
  });
});

// ---------------------------------------------------------------------------
// Fill rule
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — fill-rule', () => {
  it('should use f (non-zero winding) by default', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><path d="M 0 0 L 100 0 L 100 100 Z" fill="red"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('f\n');
    expect(ops).not.toContain('f*\n');
  });

  it('should use f* (even-odd rule) when fill-rule="evenodd"', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><path d="M 0 0 L 100 0 L 100 100 Z" fill="red" fill-rule="evenodd"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('f*\n');
  });

  it('should use B* for fill-and-stroke with even-odd rule', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><path d="M 0 0 L 100 0 L 100 100 Z" fill="red" stroke="blue" fill-rule="evenodd"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('B*\n');
  });
});

// ---------------------------------------------------------------------------
// Stroke properties
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — stroke properties', () => {
  it('should set stroke-linecap (round)', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><line x1="0" y1="50" x2="100" y2="50" stroke="black" stroke-linecap="round"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('1 J\n'); // round = 1
  });

  it('should set stroke-linecap (square)', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><line x1="0" y1="50" x2="100" y2="50" stroke="black" stroke-linecap="square"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('2 J\n'); // square = 2
  });

  it('should set stroke-linejoin (round)', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><polyline points="0,0 50,100 100,0" stroke="black" stroke-linejoin="round" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('1 j\n'); // round = 1
  });

  it('should set stroke-linejoin (bevel)', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><polyline points="0,0 50,100 100,0" stroke="black" stroke-linejoin="bevel" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('2 j\n'); // bevel = 2
  });

  it('should set stroke-dasharray', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><line x1="0" y1="50" x2="100" y2="50" stroke="black" stroke-dasharray="5 3"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('[5 3] 0 d\n');
  });

  it('should set stroke-dasharray with dashoffset', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><line x1="0" y1="50" x2="100" y2="50" stroke="black" stroke-dasharray="10 5" stroke-dashoffset="2"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('[10 5] 2 d\n');
  });

  it('should set stroke-miterlimit', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><polyline points="0,0 50,100 100,0" stroke="black" stroke-miterlimit="8" fill="none"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('8 M\n');
  });
});

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — transforms', () => {
  it('should apply translate transform via cm operator', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><g transform="translate(10,20)"><rect x="0" y="0" width="10" height="10"/></g></svg>',
    );
    const ops = svgToPdfOperators(el);
    const cmCount = (ops.match(/cm\n/g) ?? []).length;
    expect(cmCount).toBeGreaterThanOrEqual(2); // root + group
    expect(ops).toContain('1 0 0 1 10 20 cm\n');
  });

  it('should apply scale transform', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><g transform="scale(2)"><rect x="0" y="0" width="10" height="10"/></g></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('2 0 0 2 0 0 cm\n');
  });

  it('should apply rotate transform', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><g transform="rotate(90)"><rect x="0" y="0" width="10" height="10"/></g></svg>',
    );
    const ops = svgToPdfOperators(el);
    // rotate(90) produces cos(90)=0, sin(90)=1 -> matrix(0, 1, -1, 0, 0, 0)
    expect(ops).toContain('cm\n');
  });

  it('should apply matrix transform directly', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><g transform="matrix(1,0,0,1,50,60)"><rect x="0" y="0" width="10" height="10"/></g></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('1 0 0 1 50 60 cm\n');
  });

  it('should nest transforms with q/Q save/restore', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><g transform="translate(10,10)"><g transform="scale(2)"><rect x="0" y="0" width="5" height="5"/></g></g></svg>',
    );
    const ops = svgToPdfOperators(el);
    // Should have nested q/Q pairs
    const qCount = (ops.match(/q\n/g) ?? []).length;
    const QCount = (ops.match(/Q\n/g) ?? []).length;
    expect(qCount).toBeGreaterThanOrEqual(3); // root + outer g + inner g
    expect(qCount).toBe(QCount);
  });
});

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — text elements', () => {
  it('should render <text> with BT/ET text object', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="10" y="50">Hello</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('BT\n');
    expect(ops).toContain('ET\n');
  });

  it('should set font with Tf operator', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="10" y="50" font-size="24">Hello</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('/Helvetica 24 Tf\n');
  });

  it('should position text with Td operator', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="10" y="50">Hello</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('10 50 Td\n');
  });

  it('should show text with Tj operator', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="10" y="50">Hello World</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('(Hello World) Tj\n');
  });

  it('should use default font size of 16 when not specified', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="0" y="20">Test</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('/Helvetica 16 Tf\n');
  });

  it('should map bold font-weight to Helvetica-Bold', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="0" y="20" font-weight="bold">Bold</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('/Helvetica-Bold');
  });

  it('should map italic font-style to Helvetica-Oblique', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="0" y="20" font-style="italic">Italic</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('/Helvetica-Oblique');
  });

  it('should map monospace font-family to Courier', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="0" y="20" font-family="monospace">Code</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('/Courier');
  });

  it('should map serif font-family to Times-Roman', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="0" y="20" font-family="serif">Serif</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('/Times-Roman');
  });

  it('should set text fill colour', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="10" y="50" fill="red">Red Text</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('1 0 0 rg\n');
    expect(ops).toContain('(Red Text) Tj\n');
  });

  it('should escape special characters in text', () => {
    const el = parseSvg(
      '<svg width="200" height="100"><text x="0" y="20">Hello (World)</text></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('(Hello \\(World\\)) Tj\n');
  });
});

// ---------------------------------------------------------------------------
// ViewBox and sizing
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — viewBox and sizing', () => {
  it('should handle viewBox', () => {
    const el = parseSvg(
      '<svg width="200" height="200" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('cm\n');
    expect(ops).toContain('re\n');
  });

  it('should apply viewBox offset', () => {
    const el = parseSvg(
      '<svg width="100" height="100" viewBox="50 50 100 100"><rect x="60" y="60" width="30" height="30"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    // Should have a cm with negative offset for viewBox origin
    const cmOps = ops.match(/[\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+ cm\n/g) ?? [];
    expect(cmOps.length).toBeGreaterThanOrEqual(2);
  });

  it('should respect width/height options', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><rect x="0" y="0" width="100" height="100"/></svg>',
    );
    const ops = svgToPdfOperators(el, { width: 200, height: 200 });
    // The scale factor should be 2 (200/100)
    expect(ops).toContain('2');
  });

  it('should respect x/y offset options', () => {
    const el = parseSvg('<svg width="100" height="100"></svg>');
    const ops = svgToPdfOperators(el, { x: 50, y: 50 });
    expect(ops).toContain('50');
  });

  it('should preserve aspect ratio by default', () => {
    const el = parseSvg('<svg width="100" height="200"></svg>');
    const ops = svgToPdfOperators(el, { width: 50, height: 50 });
    // preserveAspectRatio defaults to true, so scale should use Math.min
    // 50/100 = 0.5, 50/200 = 0.25 -> scale = 0.25
    expect(ops).toContain('0.25');
  });

  it('should NOT preserve aspect ratio when set to false', () => {
    const el = parseSvg('<svg width="100" height="200"></svg>');
    const ops = svgToPdfOperators(el, {
      width: 50,
      height: 100,
      preserveAspectRatio: false,
    });
    // scaleX = 50/100 = 0.5, scaleY = 100/200 = 0.5
    // With no aspect ratio preservation, these are applied independently
    // The cm operator should have 0.5 and -0.5
    expect(ops).toContain('0.5 0 0 -0.5');
  });
});

// ---------------------------------------------------------------------------
// Non-renderable elements
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — non-renderable elements', () => {
  it('should skip defs and metadata elements', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><defs><rect/></defs><title>Test</title><rect x="0" y="0" width="10" height="10"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    const reCount = (ops.match(/re\n/g) ?? []).length;
    expect(reCount).toBe(1);
  });

  it('should skip style elements', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><style>.cls { fill: red; }</style><rect x="0" y="0" width="10" height="10"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    // Only the visible rect should be rendered
    const reCount = (ops.match(/re\n/g) ?? []).length;
    expect(reCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Nested groups
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — nested groups', () => {
  it('should render elements inside nested groups', () => {
    const el = parseSvg(`
      <svg width="200" height="200">
        <g transform="translate(10,10)">
          <g transform="scale(0.5)">
            <rect x="0" y="0" width="100" height="100" fill="red"/>
            <circle cx="50" cy="50" r="30" fill="blue"/>
          </g>
        </g>
      </svg>
    `);
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('re\n');
    expect(ops).toContain('1 0 0 rg\n'); // red
    expect(ops).toContain('0 0 1 rg\n'); // blue
  });

  it('should properly save/restore state for each group', () => {
    const el = parseSvg(`
      <svg width="100" height="100">
        <g transform="translate(5,5)">
          <rect x="0" y="0" width="10" height="10"/>
        </g>
        <g transform="translate(20,20)">
          <rect x="0" y="0" width="10" height="10"/>
        </g>
      </svg>
    `);
    const ops = svgToPdfOperators(el);
    // Each group should get its own q/Q pair
    const qCount = (ops.match(/q\n/g) ?? []).length;
    const QCount = (ops.match(/Q\n/g) ?? []).length;
    expect(qCount).toBeGreaterThanOrEqual(3); // root + 2 groups
    expect(qCount).toBe(QCount);
  });
});

// ---------------------------------------------------------------------------
// Complex real-world SVG
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — complex SVG', () => {
  it('should render a complex SVG with mixed elements', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect x="0" y="0" width="400" height="300" fill="#f0f0f0"/>
        <g transform="translate(50,50)">
          <circle cx="50" cy="50" r="40" fill="#ff6b6b" stroke="#c0392b" stroke-width="2"/>
          <rect x="120" y="10" width="80" height="80" fill="#4ecdc4" rx="10"/>
          <polygon points="280,10 320,90 240,90" fill="#45b7d1" stroke="#2980b9" stroke-width="1.5"/>
        </g>
        <path d="M 50 200 C 100 150 200 250 300 200" stroke="#e74c3c" stroke-width="3" fill="none" stroke-linecap="round"/>
        <line x1="50" y1="250" x2="350" y2="250" stroke="#95a5a6" stroke-width="1" stroke-dasharray="10 5"/>
        <text x="150" y="280" font-size="18" fill="#2c3e50">Hello PDF</text>
      </svg>
    `;
    const el = parseSvg(svg);
    const ops = svgToPdfOperators(el);

    // Should contain all major operator types
    expect(ops).toContain('re\n');   // rectangles
    expect(ops).toContain('c\n');    // Bezier curves (circle, path)
    expect(ops).toContain('m\n');    // moveTo
    expect(ops).toContain('l\n');    // lineTo
    expect(ops).toContain('rg\n');   // fill colour
    expect(ops).toContain('RG\n');   // stroke colour
    expect(ops).toContain('w\n');    // stroke width
    expect(ops).toContain('cm\n');   // transform
    expect(ops).toContain('BT\n');   // text begin
    expect(ops).toContain('Tf\n');   // text font
    expect(ops).toContain('Tj\n');   // text show
    expect(ops).toContain('ET\n');   // text end
    expect(ops).toContain('d\n');    // dash pattern
    expect(ops).toContain('1 J\n');  // round linecap
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — error handling', () => {
  it('should handle empty SVG gracefully', () => {
    const el = parseSvg('<svg></svg>');
    const ops = svgToPdfOperators(el);
    // Should still produce valid q/Q wrapper
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
  });

  it('should handle SVG with no shapes gracefully', () => {
    const el = parseSvg('<svg width="100" height="100"><defs></defs></svg>');
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
  });

  it('should handle malformed path d attribute', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><path d="" fill="red"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    // Empty path should not produce path operators
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');
  });

  it('should handle missing width/height (default to 100)', () => {
    const el = parseSvg('<svg><rect x="0" y="0" width="50" height="50"/></svg>');
    const ops = svgToPdfOperators(el);
    // Should still render with default dimensions
    expect(ops).toContain('re\n');
  });

  it('should handle SVG with only metadata/defs', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><defs><circle cx="10" cy="10" r="5"/></defs><metadata>info</metadata><desc>description</desc></svg>',
    );
    const ops = svgToPdfOperators(el);
    // No shapes should be rendered — only the wrapper q/Q and cm
    expect(ops).not.toContain('re\n');
    expect(ops).not.toContain('f\n');
    expect(ops).not.toContain('S\n');
    expect(ops).not.toContain('B\n');
  });
});

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — inline styles', () => {
  it('should apply inline style fill and stroke', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><rect x="0" y="0" width="50" height="50" style="fill: blue; stroke: red; stroke-width: 3"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    expect(ops).toContain('0 0 1 rg\n'); // blue fill
    expect(ops).toContain('1 0 0 RG\n'); // red stroke
    expect(ops).toContain('3 w\n');
    expect(ops).toContain('B\n'); // fill and stroke
  });
});

// ---------------------------------------------------------------------------
// Opacity
// ---------------------------------------------------------------------------

describe('svgToPdfOperators — opacity', () => {
  it('should wrap element with opacity in q/Q', () => {
    const el = parseSvg(
      '<svg width="100" height="100"><rect x="0" y="0" width="50" height="50" fill="red" opacity="0.5"/></svg>',
    );
    const ops = svgToPdfOperators(el);
    // Opacity elements get their own q/Q pair
    const qCount = (ops.match(/q\n/g) ?? []).length;
    expect(qCount).toBeGreaterThanOrEqual(2); // root + opacity element
  });
});

// ---------------------------------------------------------------------------
// Page integration
// ---------------------------------------------------------------------------

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

  it('should render complete SVG with text and shapes', () => {
    const registry = new PdfObjectRegistry();
    const page = new PdfPage(595, 842, registry);

    const svg = `
      <svg width="200" height="100">
        <rect x="0" y="0" width="200" height="100" fill="#eee"/>
        <text x="50" y="60" font-size="20" fill="black">Test</text>
      </svg>
    `;

    drawSvgOnPage(page, svg, { x: 50, y: 400 });
    const content = page.getContentStreamData();
    expect(content).toContain('re\n');
    expect(content).toContain('BT\n');
    expect(content).toContain('(Test) Tj\n');
    expect(content).toContain('ET\n');
  });
});
