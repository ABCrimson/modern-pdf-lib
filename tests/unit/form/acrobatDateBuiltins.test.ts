/**
 * Tests for acrobatDateBuiltins — AFDate_FormatEx, AFDate_KeystrokeEx,
 * parseAcrobatDate, formatDate.
 *
 * Covers:
 * - Date formatting with various Acrobat format tokens
 * - Date parsing from format strings
 * - AFDate_FormatEx (smart parsing + formatting)
 * - AFDate_KeystrokeEx (keystroke validation)
 * - Common Acrobat date formats
 * - Edge cases (invalid dates, AM/PM, leap years)
 */

import { describe, it, expect } from 'vitest';
import {
  AFDate_FormatEx,
  AFDate_KeystrokeEx,
  parseAcrobatDate,
  formatDate,
} from '../../../src/form/acrobatDateBuiltins.js';

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  // Use a fixed date for deterministic tests: March 5, 2025, 14:30:45
  const date = new Date(2025, 2, 5, 14, 30, 45); // Month is 0-based

  it('formats mm/dd/yyyy', () => {
    expect(formatDate(date, 'mm/dd/yyyy')).toBe('03/05/2025');
  });

  it('formats dd/mm/yyyy', () => {
    expect(formatDate(date, 'dd/mm/yyyy')).toBe('05/03/2025');
  });

  it('formats yyyy-mm-dd', () => {
    expect(formatDate(date, 'yyyy-mm-dd')).toBe('2025-03-05');
  });

  it('formats m/d/yy', () => {
    expect(formatDate(date, 'm/d/yy')).toBe('3/5/25');
  });

  it('formats mmm d, yyyy', () => {
    expect(formatDate(date, 'mmm d, yyyy')).toBe('Mar 5, 2025');
  });

  it('formats mmmm dd, yyyy', () => {
    expect(formatDate(date, 'mmmm dd, yyyy')).toBe('March 05, 2025');
  });

  it('formats with abbreviated day name', () => {
    // March 5, 2025 is a Wednesday
    expect(formatDate(date, 'ddd, mmm d')).toBe('Wed, Mar 5');
  });

  it('formats with full day name', () => {
    expect(formatDate(date, 'dddd, mmmm d, yyyy')).toBe(
      'Wednesday, March 5, 2025',
    );
  });

  it('formats 24-hour time', () => {
    expect(formatDate(date, 'HH:MM:ss')).toBe('14:30:45');
  });

  it('formats 12-hour time', () => {
    expect(formatDate(date, 'hh:MM:ss tt')).toBe('02:30:45 PM');
  });

  it('formats single-digit 24-hour hour', () => {
    const morning = new Date(2025, 0, 1, 8, 5, 0);
    expect(formatDate(morning, 'H:MM')).toBe('8:05');
  });

  it('formats single-digit 12-hour hour', () => {
    const morning = new Date(2025, 0, 1, 8, 5, 0);
    expect(formatDate(morning, 'h:MM tt')).toBe('8:05 AM');
  });

  it('formats full datetime', () => {
    expect(formatDate(date, 'mm/dd/yyyy HH:MM:ss')).toBe(
      '03/05/2025 14:30:45',
    );
  });

  it('handles midnight (12 AM)', () => {
    const midnight = new Date(2025, 0, 1, 0, 0, 0);
    expect(formatDate(midnight, 'hh:MM tt')).toBe('12:00 AM');
  });

  it('handles noon (12 PM)', () => {
    const noon = new Date(2025, 0, 1, 12, 0, 0);
    expect(formatDate(noon, 'hh:MM tt')).toBe('12:00 PM');
  });

  it('handles literal text in quotes', () => {
    expect(formatDate(date, "'Date:' mm/dd/yyyy")).toBe('Date: 03/05/2025');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDate(new Date('invalid'), 'mm/dd/yyyy')).toBe('');
  });

  it('formats 2-digit year', () => {
    expect(formatDate(date, 'yy')).toBe('25');
  });
});

// ---------------------------------------------------------------------------
// parseAcrobatDate
// ---------------------------------------------------------------------------

describe('parseAcrobatDate', () => {
  it('parses mm/dd/yyyy', () => {
    const result = parseAcrobatDate('03/15/2025', 'mm/dd/yyyy');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(2); // March = 2
    expect(result!.getDate()).toBe(15);
  });

  it('parses dd/mm/yyyy', () => {
    const result = parseAcrobatDate('15/03/2025', 'dd/mm/yyyy');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(15);
  });

  it('parses yyyy-mm-dd', () => {
    const result = parseAcrobatDate('2025-12-25', 'yyyy-mm-dd');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(25);
  });

  it('parses m/d/yy (with century inference)', () => {
    const result = parseAcrobatDate('3/5/25', 'm/d/yy');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(2);
    expect(result!.getDate()).toBe(5);
  });

  it('parses 2-digit year >= 50 as 1900s', () => {
    const result = parseAcrobatDate('01/01/99', 'mm/dd/yy');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(1999);
  });

  it('parses mmm d, yyyy (abbreviated month)', () => {
    const result = parseAcrobatDate('Jan 15, 2025', 'mmm d, yyyy');
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(15);
  });

  it('parses mmmm dd, yyyy (full month)', () => {
    const result = parseAcrobatDate('December 25, 2025', 'mmmm dd, yyyy');
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(25);
  });

  it('parses time with 24-hour clock', () => {
    const result = parseAcrobatDate(
      '03/05/2025 14:30:45',
      'mm/dd/yyyy HH:MM:ss',
    );
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
    expect(result!.getSeconds()).toBe(45);
  });

  it('parses time with AM/PM', () => {
    const result = parseAcrobatDate(
      '03/05/2025 02:30 PM',
      'mm/dd/yyyy hh:MM tt',
    );
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(14);
    expect(result!.getMinutes()).toBe(30);
  });

  it('parses 12:00 AM as midnight', () => {
    const result = parseAcrobatDate('12:00 AM', 'hh:MM tt');
    // This won't have a valid year/month/day, so it will return null
    // since we require year, month, day
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAcrobatDate('', 'mm/dd/yyyy')).toBeNull();
  });

  it('returns null for invalid date (Feb 30)', () => {
    expect(parseAcrobatDate('02/30/2025', 'mm/dd/yyyy')).toBeNull();
  });

  it('returns null for month > 12', () => {
    expect(parseAcrobatDate('13/01/2025', 'mm/dd/yyyy')).toBeNull();
  });

  it('accepts leap day on leap year', () => {
    const result = parseAcrobatDate('02/29/2024', 'mm/dd/yyyy');
    expect(result).not.toBeNull();
    expect(result!.getMonth()).toBe(1);
    expect(result!.getDate()).toBe(29);
  });

  it('rejects leap day on non-leap year', () => {
    expect(parseAcrobatDate('02/29/2025', 'mm/dd/yyyy')).toBeNull();
  });

  it('parses date with day name prefix', () => {
    const result = parseAcrobatDate('Wed, 03/05/2025', 'ddd, mm/dd/yyyy');
    expect(result).not.toBeNull();
    expect(result!.getDate()).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// AFDate_FormatEx
// ---------------------------------------------------------------------------

describe('AFDate_FormatEx', () => {
  it('formats ISO date to mm/dd/yyyy', () => {
    const fmt = AFDate_FormatEx('mm/dd/yyyy');
    expect(fmt('2025-03-15')).toBe('03/15/2025');
  });

  it('formats US date to European format', () => {
    const fmt = AFDate_FormatEx('dd/mm/yyyy');
    expect(fmt('03/15/2025')).toBe('15/03/2025');
  });

  it('formats to named month format', () => {
    const fmt = AFDate_FormatEx('mmm d, yyyy');
    expect(fmt('2025-01-05')).toBe('Jan 5, 2025');
  });

  it('formats to full format with time', () => {
    const fmt = AFDate_FormatEx('mm/dd/yyyy HH:MM');
    const result = fmt('2025-03-15');
    expect(result).toMatch(/^03\/15\/2025\s+00:00$/);
  });

  it('returns empty for empty input', () => {
    const fmt = AFDate_FormatEx('mm/dd/yyyy');
    expect(fmt('')).toBe('');
  });

  it('returns original value for unparseable input', () => {
    const fmt = AFDate_FormatEx('mm/dd/yyyy');
    expect(fmt('not a date')).toBe('not a date');
  });

  it('formats named month input', () => {
    const fmt = AFDate_FormatEx('yyyy-mm-dd');
    expect(fmt('Jan 15, 2025')).toBe('2025-01-15');
  });
});

// ---------------------------------------------------------------------------
// AFDate_KeystrokeEx
// ---------------------------------------------------------------------------

describe('AFDate_KeystrokeEx', () => {
  it('accepts empty input', () => {
    const validate = AFDate_KeystrokeEx('mm/dd/yyyy');
    expect(validate('')).toBe(true);
  });

  it('accepts partial valid input', () => {
    const validate = AFDate_KeystrokeEx('mm/dd/yyyy');
    expect(validate('0')).toBe(true);
    expect(validate('03')).toBe(true);
    expect(validate('03/')).toBe(true);
    expect(validate('03/1')).toBe(true);
  });

  it('accepts complete valid date', () => {
    const validate = AFDate_KeystrokeEx('mm/dd/yyyy');
    expect(validate('03/15/2025')).toBe(true);
  });

  it('rejects letters where digits expected', () => {
    const validate = AFDate_KeystrokeEx('mm/dd/yyyy');
    expect(validate('ab/cd/efgh')).toBe(false);
  });

  it('accepts named month format', () => {
    const validate = AFDate_KeystrokeEx('mmm d, yyyy');
    expect(validate('Jan')).toBe(true);
  });

  it('accepts yyyy-mm-dd format', () => {
    const validate = AFDate_KeystrokeEx('yyyy-mm-dd');
    expect(validate('2025-03-15')).toBe(true);
  });

  it('accepts AM/PM input', () => {
    const validate = AFDate_KeystrokeEx('hh:MM tt');
    expect(validate('02:30 PM')).toBe(true);
  });

  it('rejects invalid AM/PM characters', () => {
    const validate = AFDate_KeystrokeEx('hh:MM tt');
    expect(validate('02:30 XM')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Format → Parse round-trip
// ---------------------------------------------------------------------------

describe('format → parse round-trip', () => {
  const formats = [
    'mm/dd/yyyy',
    'dd/mm/yyyy',
    'yyyy-mm-dd',
    'mmm d, yyyy',
    'mmmm dd, yyyy',
  ];

  for (const fmt of formats) {
    it(`round-trips format "${fmt}"`, () => {
      const date = new Date(2025, 6, 15); // July 15, 2025
      const formatted = formatDate(date, fmt);
      const parsed = parseAcrobatDate(formatted, fmt);
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2025);
      expect(parsed!.getMonth()).toBe(6);
      expect(parsed!.getDate()).toBe(15);
    });
  }

  it('round-trips time format', () => {
    const date = new Date(2025, 0, 1, 14, 30, 0);
    const fmt = 'mm/dd/yyyy HH:MM:ss';
    const formatted = formatDate(date, fmt);
    const parsed = parseAcrobatDate(formatted, fmt);
    expect(parsed).not.toBeNull();
    expect(parsed!.getHours()).toBe(14);
    expect(parsed!.getMinutes()).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// All month names
// ---------------------------------------------------------------------------

describe('month names', () => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  for (let i = 0; i < 12; i++) {
    it(`formats and parses ${months[i]}`, () => {
      const date = new Date(2025, i, 15);
      const formatted = formatDate(date, 'mmmm dd, yyyy');
      expect(formatted).toContain(months[i]!);

      const parsed = parseAcrobatDate(formatted, 'mmmm dd, yyyy');
      expect(parsed).not.toBeNull();
      expect(parsed!.getMonth()).toBe(i);
    });
  }
});

// ---------------------------------------------------------------------------
// Day names
// ---------------------------------------------------------------------------

describe('day names', () => {
  // Jan 5, 2025 is a Sunday
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < 7; i++) {
    it(`formats ${dayNames[i]}`, () => {
      const date = new Date(2025, 0, 5 + i); // Jan 5 = Sunday
      const formatted = formatDate(date, 'ddd');
      expect(formatted).toBe(dayNames[i]);
    });
  }
});
