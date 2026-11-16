/**
 * Errors of the standard-font metric helpers, and the name check against the metric table.
 */

import { describe, it, expect } from 'vitest';
import {
  STANDARD_FONTS,
  STANDARD_FONT_NAMES,
  isStandardFont,
  standardFontHeight,
} from '../../../../../src/assets/font/internal/standardFonts.js';
import type { StandardFontName } from '../../../../../src/assets/font/internal/standardFonts.js';
import { InvalidArgumentError } from '../../../../../src/errors.js';

const UNKNOWN = 'Comic Sans' as StandardFontName;

describe('standard font helpers typed errors', () => {
  it.each([['standardFontHeight', () => standardFontHeight(UNKNOWN, 12)]])(
    '%s throws InvalidArgumentError naming fontName for an unknown font',
    (_name, call) => {
      let error: unknown;
      try {
        call();
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(InvalidArgumentError);
      expect(error).toMatchObject({
        code: 'invalid-argument',
        argument: 'fontName',
        message: 'Unknown standard font: Comic Sans',
      });
    },
  );
});

describe('isStandardFont', () => {
  it('answers from the same 14 names that key the metric table', () => {
    expect([...STANDARD_FONTS.keys()].toSorted()).toEqual([...STANDARD_FONT_NAMES].toSorted());
    for (const name of STANDARD_FONT_NAMES) expect(isStandardFont(name), name).toBe(true);
  });

  it.each(['', 'helvetica', 'Helvetica ', 'Arial', 'toString', '__proto__', 'Times'])(
    'refuses %j',
    (name) => {
      expect(isStandardFont(name)).toBe(false);
    },
  );
});
