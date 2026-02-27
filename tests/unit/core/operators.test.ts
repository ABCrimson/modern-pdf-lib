/**
 * Tests for PDF operator functions.
 *
 * Verifies that each operator function produces correct PDF syntax
 * strings that conform to the PDF 1.7 specification.
 */

import { describe, it, expect } from 'vitest';
import {
  beginText,
  endText,
  setFont,
  showText,
  moveText,
} from '../../../src/core/operators/text.js';
import {
  rectangle,
  moveTo,
  lineTo,
  stroke,
  fill,
  setLineWidth,
  setDashPattern,
  circlePath,
  ellipsePath,
} from '../../../src/core/operators/graphics.js';
import {
  rgb,
  setFillColorRgb,
  setStrokeColorRgb,
} from '../../../src/core/operators/color.js';
import {
  saveState,
  restoreState,
  concatMatrix,
  degrees,
} from '../../../src/core/operators/state.js';
import {
  drawXObject,
} from '../../../src/core/operators/image.js';

// ---------------------------------------------------------------------------
// Text operators
// ---------------------------------------------------------------------------

describe('Text operators', () => {
  it('beginText() returns "BT\\n"', () => {
    expect(beginText()).toBe('BT\n');
  });

  it('endText() returns "ET\\n"', () => {
    expect(endText()).toBe('ET\n');
  });

  it('setFont("F1", 12) returns "/F1 12 Tf\\n"', () => {
    expect(setFont('F1', 12)).toBe('/F1 12 Tf\n');
  });

  it('setFont with leading slash does not double the slash', () => {
    expect(setFont('/F1', 12)).toBe('/F1 12 Tf\n');
  });

  it('showText("Hello") returns "(Hello) Tj\\n"', () => {
    expect(showText('Hello')).toBe('(Hello) Tj\n');
  });

  it('showText properly escapes parentheses and backslashes', () => {
    // Parentheses must be escaped
    expect(showText('a(b)c')).toBe('(a\\(b\\)c) Tj\n');
    // Backslashes must be escaped
    expect(showText('a\\b')).toBe('(a\\\\b) Tj\n');
    // Combined
    expect(showText('(test\\)')).toBe('(\\(test\\\\\\)) Tj\n');
  });

  it('moveText(50, 700) returns "50 700 Td\\n"', () => {
    expect(moveText(50, 700)).toBe('50 700 Td\n');
  });
});

// ---------------------------------------------------------------------------
// Graphics operators
// ---------------------------------------------------------------------------

describe('Graphics operators', () => {
  it('rectangle(10, 20, 100, 50) returns "10 20 100 50 re\\n"', () => {
    expect(rectangle(10, 20, 100, 50)).toBe('10 20 100 50 re\n');
  });

  it('moveTo(10, 20) returns "10 20 m\\n"', () => {
    expect(moveTo(10, 20)).toBe('10 20 m\n');
  });

  it('lineTo(100, 200) returns "100 200 l\\n"', () => {
    expect(lineTo(100, 200)).toBe('100 200 l\n');
  });

  it('stroke() returns "S\\n"', () => {
    expect(stroke()).toBe('S\n');
  });

  it('fill() returns "f\\n"', () => {
    expect(fill()).toBe('f\n');
  });

  it('setLineWidth(2) returns "2 w\\n"', () => {
    expect(setLineWidth(2)).toBe('2 w\n');
  });

  it('setDashPattern([5, 3], 0) returns "[5 3] 0 d\\n"', () => {
    expect(setDashPattern([5, 3], 0)).toBe('[5 3] 0 d\n');
  });

  it('setDashPattern with empty array produces "[] 0 d\\n"', () => {
    expect(setDashPattern([], 0)).toBe('[] 0 d\n');
  });
});

// ---------------------------------------------------------------------------
// State operators
// ---------------------------------------------------------------------------

describe('State operators', () => {
  it('saveState() returns "q\\n"', () => {
    expect(saveState()).toBe('q\n');
  });

  it('restoreState() returns "Q\\n"', () => {
    expect(restoreState()).toBe('Q\n');
  });

  it('concatMatrix(1, 0, 0, 1, 50, 100) returns "1 0 0 1 50 100 cm\\n"', () => {
    expect(concatMatrix(1, 0, 0, 1, 50, 100)).toBe('1 0 0 1 50 100 cm\n');
  });

  it('degrees(45) returns an object with type "degrees" and value 45', () => {
    const angle = degrees(45);
    expect(angle.type).toBe('degrees');
    expect(angle.value).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// Color operators
// ---------------------------------------------------------------------------

describe('Color operators', () => {
  it('setFillColorRgb(1, 0, 0) returns "1 0 0 rg\\n"', () => {
    expect(setFillColorRgb(1, 0, 0)).toBe('1 0 0 rg\n');
  });

  it('setStrokeColorRgb(0, 1, 0) returns "0 1 0 RG\\n"', () => {
    expect(setStrokeColorRgb(0, 1, 0)).toBe('0 1 0 RG\n');
  });

  it('rgb(1, 0, 0) returns an object with type "rgb", r: 1, g: 0, b: 0', () => {
    const color = rgb(1, 0, 0);
    expect(color.type).toBe('rgb');
    expect(color.r).toBe(1);
    expect(color.g).toBe(0);
    expect(color.b).toBe(0);
  });

  it('rgb() clamps values to [0, 1]', () => {
    const color = rgb(2, -1, 0.5);
    expect(color.r).toBe(1);
    expect(color.g).toBe(0);
    expect(color.b).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Image operators
// ---------------------------------------------------------------------------

describe('Image operators', () => {
  it('drawXObject("Im1") returns "/Im1 Do\\n"', () => {
    expect(drawXObject('Im1')).toBe('/Im1 Do\n');
  });

  it('drawXObject with leading slash does not double it', () => {
    expect(drawXObject('/Im1')).toBe('/Im1 Do\n');
  });
});

// ---------------------------------------------------------------------------
// Complex path operators
// ---------------------------------------------------------------------------

describe('Circle and ellipse paths', () => {
  it('circlePath() produces 4 cubic bezier curve commands', () => {
    const ops = circlePath(100, 100, 50);
    // Should contain: 1 moveTo + 4 curveTo commands
    const lines = ops.split('\n').filter((l) => l.length > 0);

    // First line is moveTo
    expect(lines[0]).toMatch(/\d.* \d.* m/);

    // Remaining 4 lines are curveTo
    const curveLines = lines.filter((l) => l.endsWith(' c'));
    expect(curveLines.length).toBe(4);

    // Each curveTo should have 6 numbers + ' c'
    for (const line of curveLines) {
      const parts = line.replace(' c', '').trim().split(/\s+/);
      expect(parts.length).toBe(6);
    }
  });

  it('ellipsePath() produces 4 cubic bezier curve commands', () => {
    const ops = ellipsePath(100, 100, 60, 40);
    const lines = ops.split('\n').filter((l) => l.length > 0);

    expect(lines[0]).toMatch(/\d.* \d.* m/);

    const curveLines = lines.filter((l) => l.endsWith(' c'));
    expect(curveLines.length).toBe(4);
  });

  it('ellipsePath with equal radii produces same shape as circlePath', () => {
    const circle = circlePath(50, 50, 30);
    const ellipse = ellipsePath(50, 50, 30, 30);
    expect(circle).toBe(ellipse);
  });
});
