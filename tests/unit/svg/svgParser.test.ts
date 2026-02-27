/**
 * Tests for the SVG parser.
 *
 * Covers:
 * - SVG path `d` attribute parsing (all commands)
 * - Shape elements (rect, circle, ellipse, line, polyline, polygon)
 * - Colour parsing (hex, rgb, named)
 * - Transform parsing (matrix, translate, scale, rotate, skew)
 * - Full SVG document parsing
 */

import { describe, it, expect } from 'vitest';
import {
  parseSvg,
  parseSvgPath,
  parseSvgColor,
  parseSvgTransform,
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
