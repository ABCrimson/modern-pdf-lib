/**
 * Tests for the SVG parser.
 *
 * Covers:
 * - SVG path `d` attribute parsing (all commands)
 * - Shape elements (rect, circle, ellipse, line, polyline, polygon)
 * - Colour parsing (hex, rgb, rgba, hsl, hsla, named)
 * - Transform parsing (matrix, translate, scale, rotate, skew)
 * - Fill-rule, stroke-linecap, stroke-linejoin, stroke-dasharray
 * - Font/text attribute parsing
 * - Full SVG document parsing
 * - Gradient parsing (linearGradient, radialGradient, stops, transforms)
 * - Gradient stop interpolation and spread methods
 */

import { describe, it, expect } from 'vitest';
import {
  parseSvg,
  parseSvgPath,
  parseSvgColor,
  parseSvgTransform,
  interpolateLinearRgb,
  applySpreadMethod,
} from '../../../src/assets/svg/svgParser.js';

// ---------------------------------------------------------------------------
// parseSvgColor
// ---------------------------------------------------------------------------

describe('parseSvgColor', () => {
  it('should parse #rrggbb', () => {
    const c = parseSvgColor('#ff8000');
    expect(c).toEqual({ r: 255, g: 128, b: 0 });
  });

  it('should parse #rgb shorthand', () => {
    const c = parseSvgColor('#f00');
    expect(c).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should parse rgb(r, g, b)', () => {
    const c = parseSvgColor('rgb(100, 200, 50)');
    expect(c).toEqual({ r: 100, g: 200, b: 50 });
  });

  it('should parse rgba(r, g, b, a)', () => {
    const c = parseSvgColor('rgba(100, 200, 50, 0.5)');
    expect(c).toEqual({ r: 100, g: 200, b: 50, a: 0.5 });
  });

  it('should parse named colours', () => {
    expect(parseSvgColor('red')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseSvgColor('blue')).toEqual({ r: 0, g: 0, b: 255 });
    expect(parseSvgColor('black')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseSvgColor('white')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('should return undefined for "none"', () => {
    expect(parseSvgColor('none')).toBeUndefined();
  });

  it('should return undefined for "transparent"', () => {
    expect(parseSvgColor('transparent')).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(parseSvgColor('')).toBeUndefined();
  });

  it('should handle case insensitivity', () => {
    expect(parseSvgColor('RED')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseSvgColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
});

// ---------------------------------------------------------------------------
// parseSvgTransform
// ---------------------------------------------------------------------------

describe('parseSvgTransform', () => {
  it('should return identity for empty string', () => {
    expect(parseSvgTransform('')).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('should parse translate(tx, ty)', () => {
    const m = parseSvgTransform('translate(10, 20)');
    expect(m[4]).toBeCloseTo(10);
    expect(m[5]).toBeCloseTo(20);
    expect(m[0]).toBeCloseTo(1);
    expect(m[3]).toBeCloseTo(1);
  });

  it('should parse scale(sx, sy)', () => {
    const m = parseSvgTransform('scale(2, 3)');
    expect(m[0]).toBeCloseTo(2);
    expect(m[3]).toBeCloseTo(3);
  });

  it('should parse uniform scale(s)', () => {
    const m = parseSvgTransform('scale(2)');
    expect(m[0]).toBeCloseTo(2);
    expect(m[3]).toBeCloseTo(2);
  });

  it('should parse rotate(deg)', () => {
    const m = parseSvgTransform('rotate(90)');
    expect(m[0]).toBeCloseTo(0, 5);
    expect(m[1]).toBeCloseTo(1, 5);
    expect(m[2]).toBeCloseTo(-1, 5);
    expect(m[3]).toBeCloseTo(0, 5);
  });

  it('should parse rotate(deg, cx, cy)', () => {
    const m = parseSvgTransform('rotate(90, 50, 50)');
    // After rotation about (50,50), the matrix should differ from origin rotation
    expect(m[0]).toBeCloseTo(0, 5);
    expect(m[1]).toBeCloseTo(1, 5);
  });

  it('should parse matrix(a, b, c, d, e, f)', () => {
    const m = parseSvgTransform('matrix(1, 0, 0, 1, 10, 20)');
    expect(m).toEqual([1, 0, 0, 1, 10, 20]);
  });

  it('should compose multiple transforms', () => {
    const m = parseSvgTransform('translate(10, 0) scale(2)');
    // translate then scale: final matrix is scale * translate
    expect(m[0]).toBeCloseTo(2);
    expect(m[4]).toBeCloseTo(10);
  });

  it('should parse skewX', () => {
    const m = parseSvgTransform('skewX(45)');
    expect(m[2]).toBeCloseTo(1, 5);
    expect(m[0]).toBeCloseTo(1);
  });

  it('should parse skewY', () => {
    const m = parseSvgTransform('skewY(45)');
    expect(m[1]).toBeCloseTo(1, 5);
    expect(m[3]).toBeCloseTo(1);
  });
});

// ---------------------------------------------------------------------------
// parseSvgPath
// ---------------------------------------------------------------------------

describe('parseSvgPath', () => {
  it('should parse M L Z commands', () => {
    const cmds = parseSvgPath('M 10 20 L 30 40 Z');
    expect(cmds).toHaveLength(3);
    expect(cmds[0]).toEqual({ type: 'moveTo', params: [10, 20] });
    expect(cmds[1]).toEqual({ type: 'lineTo', params: [30, 40] });
    expect(cmds[2]).toEqual({ type: 'closePath', params: [] });
  });

  it('should parse relative m l z', () => {
    const cmds = parseSvgPath('m 10 20 l 5 5 z');
    expect(cmds).toHaveLength(3);
    expect(cmds[0]).toEqual({ type: 'moveTo', params: [10, 20] });
    expect(cmds[1]).toEqual({ type: 'lineTo', params: [15, 25] });
    expect(cmds[2]).toEqual({ type: 'closePath', params: [] });
  });

  it('should parse H and V commands', () => {
    const cmds = parseSvgPath('M 0 0 H 100 V 200');
    expect(cmds).toHaveLength(3);
    expect(cmds[1]).toEqual({ type: 'lineTo', params: [100, 0] });
    expect(cmds[2]).toEqual({ type: 'lineTo', params: [100, 200] });
  });

  it('should parse h and v commands (relative)', () => {
    const cmds = parseSvgPath('M 10 10 h 20 v 30');
    expect(cmds[1]).toEqual({ type: 'lineTo', params: [30, 10] });
    expect(cmds[2]).toEqual({ type: 'lineTo', params: [30, 40] });
  });

  it('should parse C (cubic bezier)', () => {
    const cmds = parseSvgPath('M 0 0 C 10 20 30 40 50 60');
    expect(cmds[1]).toEqual({
      type: 'curveTo',
      params: [10, 20, 30, 40, 50, 60],
    });
  });

  it('should parse c (relative cubic bezier)', () => {
    const cmds = parseSvgPath('M 10 10 c 5 5 10 10 15 15');
    expect(cmds[1]).toEqual({
      type: 'curveTo',
      params: [15, 15, 20, 20, 25, 25],
    });
  });

  it('should parse Q (quadratic bezier)', () => {
    const cmds = parseSvgPath('M 0 0 Q 50 100 100 0');
    expect(cmds[1]).toEqual({
      type: 'quadCurveTo',
      params: [50, 100, 100, 0],
    });
  });

  it('should parse A (arc)', () => {
    const cmds = parseSvgPath('M 10 80 A 45 45 0 0 0 125 125');
    expect(cmds[1]!.type).toBe('arc');
    expect(cmds[1]!.params[0]).toBe(45); // rx
    expect(cmds[1]!.params[1]).toBe(45); // ry
  });

  it('should parse S (smooth cubic)', () => {
    const cmds = parseSvgPath('M 0 0 C 10 20 30 40 50 60 S 70 80 90 100');
    expect(cmds).toHaveLength(3);
    expect(cmds[2]!.type).toBe('curveTo');
  });

  it('should parse T (smooth quadratic)', () => {
    const cmds = parseSvgPath('M 0 0 Q 50 100 100 0 T 200 0');
    expect(cmds).toHaveLength(3);
    expect(cmds[2]!.type).toBe('quadCurveTo');
  });

  it('should handle empty d attribute', () => {
    expect(parseSvgPath('')).toHaveLength(0);
  });

  it('should handle implicit L after M', () => {
    const cmds = parseSvgPath('M 0 0 10 10 20 20');
    expect(cmds).toHaveLength(3);
    expect(cmds[0]!.type).toBe('moveTo');
    expect(cmds[1]!.type).toBe('lineTo');
    expect(cmds[2]!.type).toBe('lineTo');
  });

  it('should parse relative arc (a)', () => {
    const cmds = parseSvgPath('M 10 10 a 20 20 0 0 1 40 0');
    expect(cmds[1]!.type).toBe('arc');
    // Relative: target = (10+40, 10+0) = (50, 10)
    expect(cmds[1]!.params[5]).toBe(50);
    expect(cmds[1]!.params[6]).toBe(10);
  });

  it('should parse multiple repeated commands', () => {
    const cmds = parseSvgPath('M 0 0 L 10 10 20 20 30 30');
    expect(cmds).toHaveLength(4);
    expect(cmds[1]!.type).toBe('lineTo');
    expect(cmds[2]!.type).toBe('lineTo');
    expect(cmds[3]!.type).toBe('lineTo');
    expect(cmds[3]!.params).toEqual([30, 30]);
  });

  it('should handle negative numbers in path data', () => {
    const cmds = parseSvgPath('M -10 -20 L -30 -40');
    expect(cmds[0]!.params).toEqual([-10, -20]);
    expect(cmds[1]!.params).toEqual([-30, -40]);
  });

  it('should handle scientific notation in path data', () => {
    const cmds = parseSvgPath('M 1e2 2e1 L 3e0 4');
    expect(cmds[0]!.params).toEqual([100, 20]);
    expect(cmds[1]!.params).toEqual([3, 4]);
  });
});

// ---------------------------------------------------------------------------
// parseSvg
// ---------------------------------------------------------------------------

describe('parseSvg', () => {
  it('should parse a simple SVG with a rectangle', () => {
    const svg = '<svg width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="red"/></svg>';
    const el = parseSvg(svg);
    expect(el.tag).toBe('svg');
    expect(el.children).toHaveLength(1);

    const rect = el.children[0]!;
    expect(rect.tag).toBe('rect');
    expect(rect.commands).toBeDefined();
    expect(rect.commands).toHaveLength(1);
    expect(rect.commands![0]!.type).toBe('rect');
    expect(rect.fill).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should parse a circle', () => {
    const svg = '<svg><circle cx="50" cy="50" r="40" fill="blue"/></svg>';
    const el = parseSvg(svg);
    const circle = el.children[0]!;
    expect(circle.tag).toBe('circle');
    expect(circle.commands![0]!.type).toBe('circle');
    expect(circle.commands![0]!.params).toEqual([50, 50, 40]);
  });

  it('should parse an ellipse', () => {
    const svg = '<svg><ellipse cx="50" cy="50" rx="40" ry="20" stroke="green"/></svg>';
    const el = parseSvg(svg);
    const ellipse = el.children[0]!;
    expect(ellipse.commands![0]!.type).toBe('ellipse');
    expect(ellipse.stroke).toEqual({ r: 0, g: 128, b: 0 });
  });

  it('should parse a path', () => {
    const svg = '<svg><path d="M 0 0 L 100 100" stroke="black" stroke-width="2"/></svg>';
    const el = parseSvg(svg);
    const path = el.children[0]!;
    expect(path.commands).toHaveLength(2);
    expect(path.strokeWidth).toBe(2);
  });

  it('should parse nested groups', () => {
    const svg = '<svg><g transform="translate(10,20)"><rect x="0" y="0" width="50" height="50"/></g></svg>';
    const el = parseSvg(svg);
    const g = el.children[0]!;
    expect(g.tag).toBe('g');
    expect(g.transform).toBeDefined();
    expect(g.children).toHaveLength(1);
  });

  it('should parse a line', () => {
    const svg = '<svg><line x1="0" y1="0" x2="100" y2="100"/></svg>';
    const el = parseSvg(svg);
    const line = el.children[0]!;
    expect(line.commands).toHaveLength(2);
    expect(line.commands![0]!.type).toBe('moveTo');
    expect(line.commands![1]!.type).toBe('lineTo');
  });

  it('should parse a polygon', () => {
    const svg = '<svg><polygon points="50,0 100,100 0,100"/></svg>';
    const el = parseSvg(svg);
    const poly = el.children[0]!;
    expect(poly.commands!.length).toBeGreaterThan(0);
    expect(poly.commands![poly.commands!.length - 1]!.type).toBe('closePath');
  });

  it('should parse a polyline', () => {
    const svg = '<svg><polyline points="0,0 50,50 100,0"/></svg>';
    const el = parseSvg(svg);
    const pline = el.children[0]!;
    expect(pline.commands).toHaveLength(3);
    expect(pline.commands![0]!.type).toBe('moveTo');
  });

  it('should parse inline styles', () => {
    const svg = '<svg><rect x="0" y="0" width="10" height="10" style="fill: blue; stroke: red; stroke-width: 2"/></svg>';
    const el = parseSvg(svg);
    const rect = el.children[0]!;
    expect(rect.fill).toEqual({ r: 0, g: 0, b: 255 });
    expect(rect.stroke).toEqual({ r: 255, g: 0, b: 0 });
    expect(rect.strokeWidth).toBe(2);
  });

  it('should handle empty SVG', () => {
    const el = parseSvg('<svg></svg>');
    expect(el.tag).toBe('svg');
    expect(el.children).toHaveLength(0);
  });

  it('should parse opacity', () => {
    const svg = '<svg><rect x="0" y="0" width="10" height="10" opacity="0.5"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.opacity).toBe(0.5);
  });

  it('should skip XML comments and processing instructions', () => {
    const svg = '<?xml version="1.0"?><!-- comment --><svg><rect x="0" y="0" width="10" height="10"/></svg>';
    const el = parseSvg(svg);
    expect(el.tag).toBe('svg');
    expect(el.children).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// parseSvg — fill-rule, stroke properties, text/font attributes
// ---------------------------------------------------------------------------

describe('parseSvg — extended attributes', () => {
  it('should parse fill-rule="evenodd"', () => {
    const svg = '<svg><path d="M 0 0 L 10 0 L 10 10 Z" fill="red" fill-rule="evenodd"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fillRule).toBe('evenodd');
  });

  it('should parse fill-rule="nonzero"', () => {
    const svg = '<svg><path d="M 0 0 L 10 0 L 10 10 Z" fill="red" fill-rule="nonzero"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fillRule).toBe('nonzero');
  });

  it('should default fillRule to undefined when not specified', () => {
    const svg = '<svg><rect x="0" y="0" width="10" height="10"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fillRule).toBeUndefined();
  });

  it('should parse stroke-linecap', () => {
    const svg = '<svg><line x1="0" y1="0" x2="10" y2="0" stroke="black" stroke-linecap="round"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeLinecap).toBe('round');
  });

  it('should parse stroke-linecap="square"', () => {
    const svg = '<svg><line x1="0" y1="0" x2="10" y2="0" stroke="black" stroke-linecap="square"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeLinecap).toBe('square');
  });

  it('should parse stroke-linejoin', () => {
    const svg = '<svg><polyline points="0,0 5,10 10,0" stroke="black" stroke-linejoin="bevel"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeLinejoin).toBe('bevel');
  });

  it('should parse stroke-linejoin="round"', () => {
    const svg = '<svg><polyline points="0,0 5,10 10,0" stroke="black" stroke-linejoin="round"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeLinejoin).toBe('round');
  });

  it('should parse stroke-miterlimit', () => {
    const svg = '<svg><polyline points="0,0 5,10 10,0" stroke="black" stroke-miterlimit="8"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeMiterlimit).toBe(8);
  });

  it('should parse stroke-dasharray', () => {
    const svg = '<svg><line x1="0" y1="0" x2="100" y2="0" stroke="black" stroke-dasharray="5 3 2"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeDasharray).toEqual([5, 3, 2]);
  });

  it('should parse stroke-dashoffset', () => {
    const svg = '<svg><line x1="0" y1="0" x2="100" y2="0" stroke="black" stroke-dasharray="5 3" stroke-dashoffset="2"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeDashoffset).toBe(2);
  });

  it('should ignore stroke-dasharray="none"', () => {
    const svg = '<svg><line x1="0" y1="0" x2="100" y2="0" stroke="black" stroke-dasharray="none"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeDasharray).toBeUndefined();
  });

  it('should parse font-family', () => {
    const svg = '<svg><text x="0" y="10" font-family="Arial">Test</text></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fontFamily).toBe('Arial');
  });

  it('should strip quotes from font-family', () => {
    const svg = `<svg><text x="0" y="10" font-family="'Courier New'">Test</text></svg>`;
    const el = parseSvg(svg);
    expect(el.children[0]!.fontFamily).toBe('Courier New');
  });

  it('should parse font-size', () => {
    const svg = '<svg><text x="0" y="10" font-size="24">Test</text></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fontSize).toBe(24);
  });

  it('should parse font-weight', () => {
    const svg = '<svg><text x="0" y="10" font-weight="bold">Bold</text></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fontWeight).toBe('bold');
  });

  it('should parse font-style', () => {
    const svg = '<svg><text x="0" y="10" font-style="italic">Italic</text></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fontStyle).toBe('italic');
  });

  it('should parse text-anchor', () => {
    const svg = '<svg><text x="50" y="10" text-anchor="middle">Centered</text></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.textAnchor).toBe('middle');
  });

  it('should store text content', () => {
    const svg = '<svg><text x="0" y="10">Hello World</text></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.textContent).toBe('Hello World');
  });

  it('should parse fill-rule from inline style', () => {
    const svg = '<svg><path d="M 0 0 L 10 0 L 10 10 Z" style="fill: red; fill-rule: evenodd"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.fillRule).toBe('evenodd');
  });

  it('should parse stroke-dasharray from inline style', () => {
    const svg = '<svg><line x1="0" y1="0" x2="100" y2="0" style="stroke: black; stroke-dasharray: 10 5"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeDasharray).toEqual([10, 5]);
  });

  it('should parse stroke-linecap from inline style', () => {
    const svg = '<svg><line x1="0" y1="0" x2="100" y2="0" style="stroke: black; stroke-linecap: square"/></svg>';
    const el = parseSvg(svg);
    expect(el.children[0]!.strokeLinecap).toBe('square');
  });
});

// ---------------------------------------------------------------------------
// parseSvgColor — HSL support
// ---------------------------------------------------------------------------

describe('parseSvgColor — HSL', () => {
  it('should parse hsl(0, 100%, 50%) as red', () => {
    const c = parseSvgColor('hsl(0, 100%, 50%)');
    expect(c).toBeDefined();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(0);
    expect(c!.b).toBe(0);
  });

  it('should parse hsl(120, 100%, 50%) as green', () => {
    const c = parseSvgColor('hsl(120, 100%, 50%)');
    expect(c).toBeDefined();
    expect(c!.r).toBe(0);
    expect(c!.g).toBe(255);
    expect(c!.b).toBe(0);
  });

  it('should parse hsl(240, 100%, 50%) as blue', () => {
    const c = parseSvgColor('hsl(240, 100%, 50%)');
    expect(c).toBeDefined();
    expect(c!.r).toBe(0);
    expect(c!.g).toBe(0);
    expect(c!.b).toBe(255);
  });

  it('should parse hsla with alpha', () => {
    const c = parseSvgColor('hsla(0, 100%, 50%, 0.5)');
    expect(c).toBeDefined();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(0);
    expect(c!.b).toBe(0);
    expect(c!.a).toBe(0.5);
  });

  it('should parse hsl(0, 0%, 50%) as gray', () => {
    const c = parseSvgColor('hsl(0, 0%, 50%)');
    expect(c).toBeDefined();
    expect(c!.r).toBe(128);
    expect(c!.g).toBe(128);
    expect(c!.b).toBe(128);
  });

  it('should parse hsl(60, 100%, 50%) as yellow', () => {
    const c = parseSvgColor('hsl(60, 100%, 50%)');
    expect(c).toBeDefined();
    expect(c!.r).toBe(255);
    expect(c!.g).toBe(255);
    expect(c!.b).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Gradient parsing
// ---------------------------------------------------------------------------

describe('parseSvg — gradients', () => {
  it('should parse a simple linearGradient with 2 stops', () => {
    const svg = `
      <svg width="200" height="200">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="200" height="200" fill="url(#grad1)"/>
      </svg>
    `;
    const el = parseSvg(svg);
    expect(el.gradients).toBeDefined();
    expect(el.gradients!.size).toBe(1);

    const grad = el.gradients!.get('grad1')!;
    expect(grad.type).toBe('linearGradient');
    expect(grad.stops).toHaveLength(2);
    expect(grad.stops[0]!.color).toEqual({ r: 255, g: 0, b: 0 });
    expect(grad.stops[1]!.color).toEqual({ r: 0, g: 0, b: 255 });
    expect(grad.stops[0]!.offset).toBe(0);
    expect(grad.stops[1]!.offset).toBe(1);
  });

  it('should parse a complex gradient with 5+ stops', () => {
    const svg = `
      <svg width="200" height="200">
        <defs>
          <linearGradient id="rainbow">
            <stop offset="0%" stop-color="red"/>
            <stop offset="20%" stop-color="orange"/>
            <stop offset="40%" stop-color="yellow"/>
            <stop offset="60%" stop-color="green"/>
            <stop offset="80%" stop-color="blue"/>
            <stop offset="100%" stop-color="purple"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('rainbow')!;
    expect(grad.stops).toHaveLength(6);
    expect(grad.stops[0]!.offset).toBeCloseTo(0);
    expect(grad.stops[1]!.offset).toBeCloseTo(0.2);
    expect(grad.stops[2]!.offset).toBeCloseTo(0.4);
    expect(grad.stops[3]!.offset).toBeCloseTo(0.6);
    expect(grad.stops[4]!.offset).toBeCloseTo(0.8);
    expect(grad.stops[5]!.offset).toBeCloseTo(1);
  });

  it('should sort stops by offset', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="unsorted">
            <stop offset="100%" stop-color="blue"/>
            <stop offset="0%" stop-color="red"/>
            <stop offset="50%" stop-color="green"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('unsorted')!;
    expect(grad.stops[0]!.offset).toBe(0);
    expect(grad.stops[1]!.offset).toBe(0.5);
    expect(grad.stops[2]!.offset).toBe(1);
    expect(grad.stops[0]!.color).toEqual({ r: 255, g: 0, b: 0 });
    expect(grad.stops[1]!.color).toEqual({ r: 0, g: 128, b: 0 });
    expect(grad.stops[2]!.color).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('should handle duplicate stop offsets (keep last value)', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="dupes">
            <stop offset="0%" stop-color="red"/>
            <stop offset="50%" stop-color="green"/>
            <stop offset="50%" stop-color="yellow"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('dupes')!;
    // Should have 3 stops (duplicate at 50% resolved to last: yellow)
    expect(grad.stops).toHaveLength(3);
    expect(grad.stops[1]!.color).toEqual({ r: 255, g: 255, b: 0 }); // yellow
  });

  it('should handle single stop (duplicate at 0 and 1)', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="single">
            <stop offset="50%" stop-color="red"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('single')!;
    expect(grad.stops).toHaveLength(2);
    expect(grad.stops[0]!.offset).toBe(0);
    expect(grad.stops[1]!.offset).toBe(1);
    expect(grad.stops[0]!.color).toEqual({ r: 255, g: 0, b: 0 });
    expect(grad.stops[1]!.color).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('should handle no stops (default black-to-black)', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="empty"></linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('empty')!;
    expect(grad.stops).toHaveLength(2);
    expect(grad.stops[0]!.color).toEqual({ r: 0, g: 0, b: 0 });
    expect(grad.stops[1]!.color).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('should parse stop opacity', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="withOpacity">
            <stop offset="0%" stop-color="red" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="blue" stop-opacity="0.8"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('withOpacity')!;
    expect(grad.stops[0]!.opacity).toBe(0.5);
    expect(grad.stops[1]!.opacity).toBe(0.8);
  });

  it('should parse stop-color and stop-opacity from inline style', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="styledStops">
            <stop offset="0%" style="stop-color: red; stop-opacity: 0.3"/>
            <stop offset="100%" style="stop-color: blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('styledStops')!;
    expect(grad.stops[0]!.color).toEqual({ r: 255, g: 0, b: 0 });
    expect(grad.stops[0]!.opacity).toBeCloseTo(0.3);
    expect(grad.stops[1]!.color).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('should parse a radialGradient with focal point', () => {
    const svg = `
      <svg>
        <defs>
          <radialGradient id="radial1" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
            <stop offset="0%" stop-color="white"/>
            <stop offset="100%" stop-color="black"/>
          </radialGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('radial1')!;
    expect(grad.type).toBe('radialGradient');
    expect(grad.cx).toBeCloseTo(0.5);
    expect(grad.cy).toBeCloseTo(0.5);
    expect(grad.r).toBeCloseTo(0.5);
    expect(grad.fx).toBeCloseTo(0.3);
    expect(grad.fy).toBeCloseTo(0.3);
    expect(grad.stops).toHaveLength(2);
  });

  it('should parse gradientTransform rotation', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="rotated" gradientTransform="rotate(45)">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('rotated')!;
    expect(grad.gradientTransform).toBeDefined();
    // rotate(45): cos(45) ~ 0.7071, sin(45) ~ 0.7071
    expect(grad.gradientTransform![0]).toBeCloseTo(Math.cos(Math.PI / 4), 4);
    expect(grad.gradientTransform![1]).toBeCloseTo(Math.sin(Math.PI / 4), 4);
  });

  it('should parse spreadMethod="reflect"', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="reflected" spreadMethod="reflect">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('reflected')!;
    expect(grad.spreadMethod).toBe('reflect');
  });

  it('should parse spreadMethod="repeat"', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="repeated" spreadMethod="repeat">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('repeated')!;
    expect(grad.spreadMethod).toBe('repeat');
  });

  it('should default spreadMethod to "pad"', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="default">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('default')!;
    expect(grad.spreadMethod).toBe('pad');
  });

  it('should parse gradientUnits="userSpaceOnUse"', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="userSpace" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="0">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('userSpace')!;
    expect(grad.gradientUnits).toBe('userSpaceOnUse');
    expect(grad.x1).toBe(0);
    expect(grad.x2).toBe(200);
  });

  it('should default gradientUnits to "objectBoundingBox"', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="obb">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('obb')!;
    expect(grad.gradientUnits).toBe('objectBoundingBox');
  });

  it('should resolve fill="url(#id)" gradient references', () => {
    const svg = `
      <svg width="200" height="200">
        <defs>
          <linearGradient id="myGrad">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="200" height="200" fill="url(#myGrad)"/>
      </svg>
    `;
    const el = parseSvg(svg);
    // Find the rect (inside defs children + rect)
    const rect = el.children.find((c) => c.tag === 'rect');
    expect(rect).toBeDefined();
    expect(rect!.fillGradientId).toBe('myGrad');
  });

  it('should parse self-closing gradient elements', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="selfClose"/>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    expect(el.gradients).toBeDefined();
    expect(el.gradients!.has('selfClose')).toBe(true);
    // No stops = default black-to-black
    expect(el.gradients!.get('selfClose')!.stops).toHaveLength(2);
  });

  it('should handle nested SVG with gradient references', () => {
    const svg = `
      <svg width="400" height="400">
        <defs>
          <radialGradient id="outerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="white"/>
            <stop offset="100%" stop-color="gray"/>
          </radialGradient>
          <linearGradient id="innerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="red"/>
            <stop offset="50%" stop-color="green"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="400" height="400" fill="url(#outerGrad)"/>
        <g transform="translate(50,50)">
          <rect x="0" y="0" width="100" height="100" fill="url(#innerGrad)"/>
        </g>
      </svg>
    `;
    const el = parseSvg(svg);
    expect(el.gradients!.size).toBe(2);
    expect(el.gradients!.has('outerGrad')).toBe(true);
    expect(el.gradients!.has('innerGrad')).toBe(true);
    expect(el.gradients!.get('outerGrad')!.type).toBe('radialGradient');
    expect(el.gradients!.get('innerGrad')!.type).toBe('linearGradient');
    expect(el.gradients!.get('innerGrad')!.stops).toHaveLength(3);

    // The inner rect should reference innerGrad
    const g = el.children.find((c) => c.tag === 'g');
    const innerRect = g?.children.find((c) => c.tag === 'rect');
    expect(innerRect?.fillGradientId).toBe('innerGrad');
  });

  it('should parse stop-color with all CSS color formats', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="allFormats">
            <stop offset="0%" stop-color="#ff0000"/>
            <stop offset="16%" stop-color="#f00"/>
            <stop offset="33%" stop-color="rgb(0, 255, 0)"/>
            <stop offset="50%" stop-color="rgba(0, 0, 255, 0.8)"/>
            <stop offset="66%" stop-color="hsl(60, 100%, 50%)"/>
            <stop offset="83%" stop-color="orange"/>
            <stop offset="100%" stop-color="hsla(300, 100%, 50%, 0.5)"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('allFormats')!;
    expect(grad.stops).toHaveLength(7);

    // #ff0000 -> red
    expect(grad.stops[0]!.color).toEqual({ r: 255, g: 0, b: 0 });
    // #f00 -> red
    expect(grad.stops[1]!.color).toEqual({ r: 255, g: 0, b: 0 });
    // rgb(0, 255, 0) -> green
    expect(grad.stops[2]!.color).toEqual({ r: 0, g: 255, b: 0 });
    // rgba(0, 0, 255, 0.8) -> blue with opacity
    expect(grad.stops[3]!.color).toEqual({ r: 0, g: 0, b: 255 });
    expect(grad.stops[3]!.opacity).toBeCloseTo(0.8);
    // hsl(60, 100%, 50%) -> yellow
    expect(grad.stops[4]!.color).toEqual({ r: 255, g: 255, b: 0 });
    // orange -> named
    expect(grad.stops[5]!.color).toEqual({ r: 255, g: 165, b: 0 });
    // hsla(300, 100%, 50%, 0.5) -> magenta with opacity
    expect(grad.stops[6]!.color).toEqual({ r: 255, g: 0, b: 255 });
    expect(grad.stops[6]!.opacity).toBeCloseTo(0.5);
  });

  it('should parse gradientTransform with complex transform', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="complexTransform" gradientTransform="translate(50,50) rotate(45) scale(2)">
            <stop offset="0%" stop-color="red"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('complexTransform')!;
    expect(grad.gradientTransform).toBeDefined();
    // This is a composed matrix, so just verify it exists and is a 6-element array
    expect(grad.gradientTransform).toHaveLength(6);
  });

  it('should clamp stop offsets to [0, 1]', () => {
    const svg = `
      <svg>
        <defs>
          <linearGradient id="clamped">
            <stop offset="-10%" stop-color="red"/>
            <stop offset="150%" stop-color="blue"/>
          </linearGradient>
        </defs>
      </svg>
    `;
    const el = parseSvg(svg);
    const grad = el.gradients!.get('clamped')!;
    expect(grad.stops[0]!.offset).toBe(0);
    expect(grad.stops[1]!.offset).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// interpolateLinearRgb
// ---------------------------------------------------------------------------

describe('interpolateLinearRgb', () => {
  it('should return start colour at t=0', () => {
    const result = interpolateLinearRgb({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 0);
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it('should return end colour at t=1', () => {
    const result = interpolateLinearRgb({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 1);
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(255);
  });

  it('should interpolate at t=0.5 in linear RGB space', () => {
    const result = interpolateLinearRgb({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 0.5);
    // In linear RGB space, midpoint of (255,0,0) and (0,0,255) is brighter than sRGB midpoint
    expect(result.r).toBeGreaterThan(0);
    expect(result.r).toBeLessThan(255);
    expect(result.b).toBeGreaterThan(0);
    expect(result.b).toBeLessThan(255);
  });

  it('should handle black to white', () => {
    const result = interpolateLinearRgb({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0.5);
    // Midpoint should be approximately 188 in sRGB (sqrt(0.5) in linear)
    expect(result.r).toBeGreaterThan(100);
    expect(result.r).toBeLessThan(220);
    expect(result.r).toBe(result.g);
    expect(result.g).toBe(result.b);
  });
});

// ---------------------------------------------------------------------------
// applySpreadMethod
// ---------------------------------------------------------------------------

describe('applySpreadMethod', () => {
  it('pad: should clamp t < 0 to 0', () => {
    expect(applySpreadMethod(-0.5, 'pad')).toBe(0);
  });

  it('pad: should clamp t > 1 to 1', () => {
    expect(applySpreadMethod(1.5, 'pad')).toBe(1);
  });

  it('pad: should pass through t in [0,1]', () => {
    expect(applySpreadMethod(0.5, 'pad')).toBe(0.5);
  });

  it('repeat: should wrap t=1.3 to 0.3', () => {
    expect(applySpreadMethod(1.3, 'repeat')).toBeCloseTo(0.3, 5);
  });

  it('repeat: should wrap t=2.7 to 0.7', () => {
    expect(applySpreadMethod(2.7, 'repeat')).toBeCloseTo(0.7, 5);
  });

  it('repeat: should wrap t=-0.3 to 0.7', () => {
    expect(applySpreadMethod(-0.3, 'repeat')).toBeCloseTo(0.7, 5);
  });

  it('reflect: should mirror t=1.3 to 0.7', () => {
    expect(applySpreadMethod(1.3, 'reflect')).toBeCloseTo(0.7, 5);
  });

  it('reflect: should mirror t=2.3 to 0.3', () => {
    expect(applySpreadMethod(2.3, 'reflect')).toBeCloseTo(0.3, 5);
  });

  it('reflect: should mirror t=-0.3 to 0.3', () => {
    expect(applySpreadMethod(-0.3, 'reflect')).toBeCloseTo(0.3, 5);
  });

  it('reflect: should handle t=0.5 unchanged', () => {
    expect(applySpreadMethod(0.5, 'reflect')).toBeCloseTo(0.5, 5);
  });
});
