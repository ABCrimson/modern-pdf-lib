/**
 * Path data limits of parseSvgPath: path data ends at the first error, and no iteration loops
 * without advancing.
 */
import { describe, expect, it } from 'vitest';
import { parseSvgPath } from '../../../src/assets/svg/svgParser.js';

describe('svg path limits', () => {
  it('ends path data at a number after closepath', () => {
    for (const d of ['M0 0 L1 1 Z 5', 'M0 0 L1 1 z 5 6', 'M0 0 L1 1 Z5']) {
      expect(parseSvgPath(d).map((c) => c.type)).toEqual(['moveTo', 'lineTo', 'closePath']);
    }
  });

  it('keeps a command that follows a closepath', () => {
    const types = parseSvgPath('M0 0 L1 1 Z M2 2 L3 3 Z').map((c) => c.type);
    expect(types).toEqual(['moveTo', 'lineTo', 'closePath', 'moveTo', 'lineTo', 'closePath']);
  });

  it('returns at once for path data that holds only a number', () => {
    expect(parseSvgPath('5')).toEqual([]);
    expect(parseSvgPath('Z 5')).toEqual([{ type: 'closePath', params: [] }]);
  });
});
