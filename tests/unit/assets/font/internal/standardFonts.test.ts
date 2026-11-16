/**
 * Errors of the standard-font metric helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  measureStandardText,
  standardFontHeight,
} from '../../../../../src/assets/font/internal/standardFonts.js';
import type { StandardFontName } from '../../../../../src/assets/font/internal/standardFonts.js';
import { InvalidArgumentError } from '../../../../../src/errors.js';

const UNKNOWN = 'Comic Sans' as StandardFontName;

describe('standard font helpers typed errors', () => {
  it.each([
    ['measureStandardText', () => measureStandardText('a', UNKNOWN, 12)],
    ['standardFontHeight', () => standardFontHeight(UNKNOWN, 12)],
  ])('%s throws InvalidArgumentError naming fontName for an unknown font', (_name, call) => {
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
  });
});
