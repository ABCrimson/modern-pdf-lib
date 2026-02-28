import { describe, it, expect } from 'vitest';
import { fmtN, KAPPA, svgArcToPdfOps, svgCommandsToPdfOps } from '../../../src/core/pdfPageSvg.js';
import type { SvgDrawCommand } from '../../../src/assets/svg/svgParser.js';

describe('pdfPageSvg', () => {
  // -----------------------------------------------------------------------
  // fmtN
  // -----------------------------------------------------------------------

  describe('fmtN', () => {
    it('formats integers without a decimal point', () => {
      expect(fmtN(0)).toBe('0');
      expect(fmtN(42)).toBe('42');
      expect(fmtN(-7)).toBe('-7');
    });

    it('formats floats trimming trailing zeros', () => {
      expect(fmtN(1.5)).toBe('1.5');
      expect(fmtN(3.14159)).toBe('3.14159');
      expect(fmtN(0.100000)).toBe('0.1');
    });

    it('converts -0 to "0"', () => {
      expect(fmtN(-0)).toBe('0');
      // -0.0000001 rounds to -0 at 6 decimal places
      expect(fmtN(-0.00000001)).toBe('0');
    });

    it('handles large numbers', () => {
      expect(fmtN(1000000)).toBe('1000000');
    });

    it('handles very small decimals', () => {
      expect(fmtN(0.000001)).toBe('0.000001');
      // Below 6 decimal places precision, rounds to 0
      expect(fmtN(0.0000001)).toBe('0');
    });
  });

  // -----------------------------------------------------------------------
  // KAPPA
  // -----------------------------------------------------------------------

  describe('KAPPA', () => {
    it('equals the standard circular arc approximation constant', () => {
      expect(KAPPA).toBeCloseTo(0.5522847498, 10);
    });
  });

  // -----------------------------------------------------------------------
  // svgArcToPdfOps
  // -----------------------------------------------------------------------

  describe('svgArcToPdfOps', () => {
    it('returns a lineTo when rx or ry is zero', () => {
      const ops = svgArcToPdfOps(0, 0, 0, 10, 0, 0, 1, 100, 100);
      expect(ops).toContain('l\n');
      expect(ops).not.toContain('c\n');
    });

    it('generates cubic Bezier curves for a simple arc', () => {
      const ops = svgArcToPdfOps(0, 0, 50, 50, 0, 0, 1, 100, 0);
      expect(ops).toContain('c\n');
      // Should produce valid numeric output
      const lines = ops.trim().split('\n');
      for (const line of lines) {
        // Each line should end with 'c' and have 6 numbers
        expect(line).toMatch(/[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+c/);
      }
    });

    it('handles large arc flag and sweep flag combinations', () => {
      const ops1 = svgArcToPdfOps(0, 0, 50, 50, 0, 1, 1, 100, 0);
      const ops2 = svgArcToPdfOps(0, 0, 50, 50, 0, 0, 0, 100, 0);
      // Both should generate valid output but with different curves
      expect(ops1).toContain('c\n');
      expect(ops2).toContain('c\n');
      // They should differ since large-arc and sweep flags are different
      expect(ops1).not.toBe(ops2);
    });
  });

  // -----------------------------------------------------------------------
  // svgCommandsToPdfOps
  // -----------------------------------------------------------------------

  describe('svgCommandsToPdfOps', () => {
    it('converts moveTo commands to PDF m operator', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'moveTo', params: [10, 20] },
      ];
      expect(svgCommandsToPdfOps(commands)).toBe('10 20 m\n');
    });

    it('converts lineTo commands to PDF l operator', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'moveTo', params: [0, 0] },
        { type: 'lineTo', params: [100, 200] },
      ];
      const ops = svgCommandsToPdfOps(commands);
      expect(ops).toContain('0 0 m\n');
      expect(ops).toContain('100 200 l\n');
    });

    it('converts curveTo commands to PDF c operator', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'moveTo', params: [0, 0] },
        { type: 'curveTo', params: [10, 20, 30, 40, 50, 60] },
      ];
      const ops = svgCommandsToPdfOps(commands);
      expect(ops).toContain('10 20 30 40 50 60 c\n');
    });

    it('converts closePath to PDF h operator', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'moveTo', params: [0, 0] },
        { type: 'lineTo', params: [100, 0] },
        { type: 'lineTo', params: [100, 100] },
        { type: 'closePath', params: [] },
      ];
      const ops = svgCommandsToPdfOps(commands);
      expect(ops).toContain('h\n');
    });

    it('converts rect to PDF re operator', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'rect', params: [10, 20, 100, 50] },
      ];
      expect(svgCommandsToPdfOps(commands)).toBe('10 20 100 50 re\n');
    });

    it('converts quadCurveTo to cubic Bezier (c operator)', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'moveTo', params: [0, 0] },
        { type: 'quadCurveTo', params: [50, 100, 100, 0] },
      ];
      const ops = svgCommandsToPdfOps(commands);
      expect(ops).toContain('c\n');
      // Should not contain 'q' (PDF doesn't have a quadratic Bezier op)
      expect(ops).not.toContain(' q\n');
    });

    it('returns empty string for empty command list', () => {
      expect(svgCommandsToPdfOps([])).toBe('');
    });

    it('handles circle commands', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'circle', params: [50, 50, 25] },
      ];
      const ops = svgCommandsToPdfOps(commands);
      // A circle is approximated with 4 cubic Bezier curves + a moveTo
      expect(ops).toContain('m\n');
      const cCount = (ops.match(/ c\n/g) || []).length;
      expect(cCount).toBe(4);
    });

    it('handles ellipse commands', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'ellipse', params: [50, 50, 30, 20] },
      ];
      const ops = svgCommandsToPdfOps(commands);
      expect(ops).toContain('m\n');
      const cCount = (ops.match(/ c\n/g) || []).length;
      expect(cCount).toBe(4);
    });

    it('handles arc commands', () => {
      const commands: SvgDrawCommand[] = [
        { type: 'moveTo', params: [0, 0] },
        { type: 'arc', params: [50, 50, 0, 0, 1, 100, 0] },
      ];
      const ops = svgCommandsToPdfOps(commands);
      expect(ops).toContain('c\n');
    });
  });
});
