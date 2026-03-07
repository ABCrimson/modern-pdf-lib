/**
 * Tests for acrobatSpecialBuiltins — AFPercent and AFSpecial format/keystroke.
 */

import { describe, it, expect } from 'vitest';
import {
  AFPercent_Format,
  AFPercent_Keystroke,
  AFSpecial_Format,
  AFSpecial_Keystroke,
  formatSpecial,
  validateSpecial,
} from '../../../src/form/acrobatSpecialBuiltins.js';

// ---------------------------------------------------------------------------
// AFPercent_Format
// ---------------------------------------------------------------------------

describe('AFPercent_Format', () => {
  it('formats 0.5 as 50% with 0 decimal places', () => {
    const fmt = AFPercent_Format(0, 0);
    expect(fmt('0.5')).toBe('50%');
  });

  it('formats 0.5 as 50.00% with 2 decimal places', () => {
    const fmt = AFPercent_Format(2, 0);
    expect(fmt('0.5')).toBe('50.00%');
  });

  it('formats 1 as 100%', () => {
    const fmt = AFPercent_Format(0, 0);
    expect(fmt('1')).toBe('100%');
  });

  it('formats 0.123 as 12.30% with 2 decimals', () => {
    const fmt = AFPercent_Format(2, 0);
    expect(fmt('0.123')).toBe('12.30%');
  });

  it('handles sepStyle 0 (comma thousands, period decimal)', () => {
    const fmt = AFPercent_Format(2, 0);
    expect(fmt('12.3456')).toBe('1,234.56%');
  });

  it('handles sepStyle 1 (no thousands, period decimal)', () => {
    const fmt = AFPercent_Format(2, 1);
    expect(fmt('12.3456')).toBe('1234.56%');
  });

  it('handles sepStyle 2 (period thousands, comma decimal)', () => {
    const fmt = AFPercent_Format(2, 2);
    expect(fmt('12.3456')).toBe('1.234,56%');
  });

  it('handles sepStyle 3 (no thousands, comma decimal)', () => {
    const fmt = AFPercent_Format(2, 3);
    expect(fmt('12.3456')).toBe('1234,56%');
  });

  it('returns empty string for non-numeric input', () => {
    const fmt = AFPercent_Format(2, 0);
    expect(fmt('abc')).toBe('');
  });

  it('returns empty string for empty input', () => {
    const fmt = AFPercent_Format(2, 0);
    expect(fmt('')).toBe('');
  });

  it('handles negative values', () => {
    const fmt = AFPercent_Format(2, 0);
    expect(fmt('-0.25')).toBe('-25.00%');
  });

  it('formats 0 as 0%', () => {
    const fmt = AFPercent_Format(0, 0);
    expect(fmt('0')).toBe('0%');
  });
});

// ---------------------------------------------------------------------------
// AFPercent_Keystroke
// ---------------------------------------------------------------------------

describe('AFPercent_Keystroke', () => {
  const validate = AFPercent_Keystroke(2, 0);

  it('accepts empty string', () => {
    expect(validate('')).toBe(true);
  });

  it('accepts a single minus', () => {
    expect(validate('-')).toBe(true);
  });

  it('accepts a single period', () => {
    expect(validate('.')).toBe(true);
  });

  it('accepts valid numeric input', () => {
    expect(validate('12.34')).toBe(true);
  });

  it('accepts percentage sign', () => {
    expect(validate('50%')).toBe(true);
  });

  it('rejects alpha characters', () => {
    expect(validate('abc')).toBe(false);
  });

  it('rejects mixed invalid input', () => {
    expect(validate('12abc')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AFSpecial_Format
// ---------------------------------------------------------------------------

describe('AFSpecial_Format', () => {
  describe('psf=0 (ZIP Code)', () => {
    const fmt = AFSpecial_Format(0);

    it('formats 5 digits', () => {
      expect(fmt('12345')).toBe('12345');
    });

    it('strips non-digits and formats', () => {
      expect(fmt('1-2-3-4-5')).toBe('12345');
    });

    it('handles fewer than 5 digits', () => {
      expect(fmt('123')).toBe('123');
    });
  });

  describe('psf=1 (ZIP+4)', () => {
    const fmt = AFSpecial_Format(1);

    it('formats 9 digits as ZIP+4', () => {
      expect(fmt('123456789')).toBe('12345-6789');
    });

    it('strips non-digits', () => {
      expect(fmt('12345-6789')).toBe('12345-6789');
    });
  });

  describe('psf=2 (Phone)', () => {
    const fmt = AFSpecial_Format(2);

    it('formats 10 digits as phone', () => {
      expect(fmt('1234567890')).toBe('(123) 456-7890');
    });

    it('strips non-digits', () => {
      expect(fmt('(123) 456-7890')).toBe('(123) 456-7890');
    });
  });

  describe('psf=3 (SSN)', () => {
    const fmt = AFSpecial_Format(3);

    it('formats 9 digits as SSN', () => {
      expect(fmt('123456789')).toBe('123-45-6789');
    });

    it('strips non-digits', () => {
      expect(fmt('123-45-6789')).toBe('123-45-6789');
    });
  });

  it('returns value unchanged for unknown psf', () => {
    const fmt = AFSpecial_Format(99);
    expect(fmt('test')).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// AFSpecial_Keystroke
// ---------------------------------------------------------------------------

describe('AFSpecial_Keystroke', () => {
  describe('psf=0 (ZIP Code)', () => {
    const validate = AFSpecial_Keystroke(0);

    it('accepts 5 digits', () => {
      expect(validate('12345')).toBe(true);
    });

    it('accepts partial input', () => {
      expect(validate('123')).toBe(true);
    });

    it('rejects non-digit characters', () => {
      expect(validate('abcde')).toBe(false);
    });

    it('rejects too many digits', () => {
      expect(validate('123456')).toBe(false);
    });
  });

  describe('psf=2 (Phone)', () => {
    const validate = AFSpecial_Keystroke(2);

    it('accepts 10 digits', () => {
      expect(validate('1234567890')).toBe(true);
    });

    it('accepts partial input', () => {
      expect(validate('123')).toBe(true);
    });
  });

  describe('psf=3 (SSN)', () => {
    const validate = AFSpecial_Keystroke(3);

    it('accepts 9 digits', () => {
      expect(validate('123456789')).toBe(true);
    });

    it('rejects letters', () => {
      expect(validate('12345678a')).toBe(false);
    });
  });

  it('returns true for unknown psf', () => {
    const validate = AFSpecial_Keystroke(99);
    expect(validate('anything')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatSpecial (generic mask)
// ---------------------------------------------------------------------------

describe('formatSpecial', () => {
  it('applies digit mask', () => {
    expect(formatSpecial('123', '9-9-9')).toBe('1-2-3');
  });

  it('applies alpha mask', () => {
    expect(formatSpecial('ABC', 'a-a-a')).toBe('A-B-C');
  });

  it('applies wildcard mask', () => {
    expect(formatSpecial('A1B', '*-*-*')).toBe('A-1-B');
  });

  it('truncates when value is shorter than mask', () => {
    expect(formatSpecial('12', '99-99')).toBe('12');
  });

  it('ignores extra characters beyond mask', () => {
    expect(formatSpecial('123456', '999')).toBe('123');
  });

  it('strips non-alphanumeric from value before applying', () => {
    expect(formatSpecial('1-2-3', '999')).toBe('123');
  });
});

// ---------------------------------------------------------------------------
// validateSpecial (generic mask)
// ---------------------------------------------------------------------------

describe('validateSpecial', () => {
  it('accepts matching digit input', () => {
    expect(validateSpecial('123', '999')).toBe(true);
  });

  it('rejects letters for digit mask', () => {
    expect(validateSpecial('abc', '999')).toBe(false);
  });

  it('accepts matching alpha input', () => {
    expect(validateSpecial('abc', 'aaa')).toBe(true);
  });

  it('rejects digits for alpha mask', () => {
    expect(validateSpecial('123', 'aaa')).toBe(false);
  });

  it('accepts any character for wildcard', () => {
    expect(validateSpecial('a1!', '***')).toBe(true);
  });

  it('accepts partial input', () => {
    expect(validateSpecial('12', '99999')).toBe(true);
  });

  it('rejects too many characters', () => {
    expect(validateSpecial('123456', '999')).toBe(false);
  });
});
