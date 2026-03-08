/**
 * @module form/acrobatDateBuiltins
 *
 * Acrobat-compatible date formatting and validation built-ins.
 *
 * Implements:
 * - `AFDate_FormatEx`     — format a date string for display
 * - `AFDate_KeystrokeEx`  — validate a date keystroke
 * - `parseAcrobatDate`    — parse a date string using Acrobat format tokens
 * - `formatDate`          — format a Date using Acrobat format tokens
 *
 * Supported format tokens:
 * - `d` / `dd`       — day of month (1–31 / 01–31)
 * - `ddd` / `dddd`   — abbreviated / full weekday name
 * - `m` / `mm`       — month number (1–12 / 01–12)
 * - `mmm` / `mmmm`   — abbreviated / full month name
 * - `yy` / `yyyy`    — 2-digit / 4-digit year
 * - `H` / `HH`       — 24-hour hour (0–23 / 00–23)
 * - `h` / `hh`       — 12-hour hour (1–12 / 01–12)
 * - `MM`             — minutes (00–59)
 * - `ss`             — seconds (00–59)
 * - `tt`             — AM/PM
 * - Literal text in single quotes
 *
 * Reference: Acrobat JavaScript Scripting Reference,
 *            AFDate_FormatEx / AFDate_KeystrokeEx.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const DAY_NAMES_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

const DAY_NAMES_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
] as const;

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

interface FormatToken {
  type: 'literal' | 'pattern';
  value: string;
}

// ---------------------------------------------------------------------------
// Format string tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenize an Acrobat date format string into a list of format tokens.
 *
 * Pattern tokens are sequences of the same letter (e.g. `dd`, `yyyy`).
 * Literal text is enclosed in single quotes. Other non-letter characters
 * (like `/`, `-`, `:`, spaces) are treated as literals.
 *
 * @internal
 */
function tokenizeFormat(format: string): FormatToken[] {
  const tokens: FormatToken[] = [];
  let i = 0;

  while (i < format.length) {
    const ch = format[i]!;

    // Quoted literal
    if (ch === "'") {
      i++;
      let literal = '';
      while (i < format.length && format[i] !== "'") {
        literal += format[i]!;
        i++;
      }
      if (i < format.length) i++; // skip closing quote
      tokens.push({ type: 'literal', value: literal });
      continue;
    }

    // Check for pattern letters
    if (isPatternLetter(ch)) {
      let pattern = ch;
      i++;
      while (i < format.length && format[i] === ch) {
        pattern += format[i]!;
        i++;
      }
      tokens.push({ type: 'pattern', value: pattern });
      continue;
    }

    // Any other character is a literal separator
    tokens.push({ type: 'literal', value: ch });
    i++;
  }

  return tokens;
}

/**
 * Check if a character is a recognized pattern letter.
 * @internal
 */
function isPatternLetter(ch: string): boolean {
  return (
    ch === 'd' || ch === 'm' || ch === 'y' ||
    ch === 'H' || ch === 'h' || ch === 'M' || ch === 's' || ch === 't'
  );
}

// ---------------------------------------------------------------------------
// Padding helper
// ---------------------------------------------------------------------------

/**
 * Pad a number with leading zeros.
 * @internal
 */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

/**
 * Format a `Date` object using an Acrobat-compatible format string.
 *
 * @param date    The Date to format.
 * @param format  The Acrobat format string.
 * @returns       The formatted date string.
 */
export function formatDate(date: Date, format: string): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  const tokens = tokenizeFormat(format);
  let result = '';

  for (const token of tokens) {
    if (token.type === 'literal') {
      result += token.value;
      continue;
    }

    switch (token.value) {
      // Day
      case 'd':
        result += String(date.getDate());
        break;
      case 'dd':
        result += pad2(date.getDate());
        break;
      case 'ddd':
        result += DAY_NAMES_SHORT[date.getDay()];
        break;
      case 'dddd':
        result += DAY_NAMES_FULL[date.getDay()];
        break;

      // Month
      case 'm':
        result += String(date.getMonth() + 1);
        break;
      case 'mm':
        result += pad2(date.getMonth() + 1);
        break;
      case 'mmm':
        result += MONTH_NAMES_SHORT[date.getMonth()];
        break;
      case 'mmmm':
        result += MONTH_NAMES_FULL[date.getMonth()];
        break;

      // Year
      case 'yy':
        result += pad2(date.getFullYear() % 100);
        break;
      case 'yyyy':
        result += String(date.getFullYear());
        break;

      // Hour (24-hour)
      case 'H':
        result += String(date.getHours());
        break;
      case 'HH':
        result += pad2(date.getHours());
        break;

      // Hour (12-hour)
      case 'h': {
        let h = date.getHours() % 12;
        if (h === 0) h = 12;
        result += String(h);
        break;
      }
      case 'hh': {
        let h = date.getHours() % 12;
        if (h === 0) h = 12;
        result += pad2(h);
        break;
      }

      // Minutes
      case 'MM':
        result += pad2(date.getMinutes());
        break;

      // Seconds
      case 'ss':
        result += pad2(date.getSeconds());
        break;

      // AM/PM
      case 'tt':
        result += date.getHours() < 12 ? 'AM' : 'PM';
        break;

      default:
        // Unknown pattern — output as-is
        result += token.value;
        break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// parseAcrobatDate
// ---------------------------------------------------------------------------

/**
 * Parse a date string using an Acrobat-compatible format string.
 *
 * Attempts to extract date components (year, month, day, hour, minute,
 * second) from the input text based on the format pattern.
 *
 * @param text    The date string to parse.
 * @param format  The Acrobat format string.
 * @returns       A `Date` object, or `null` if parsing fails.
 */
export function parseAcrobatDate(text: string, format: string): Date | null {
  if (typeof text !== 'string' || text.trim() === '') return null;

  const tokens = tokenizeFormat(format);

  let year = -1;
  let month = -1; // 0-based
  let day = -1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let isPM: boolean | undefined;

  let pos = 0;

  for (const token of tokens) {
    if (pos >= text.length && token.type === 'pattern') {
      // Ran out of input but still have pattern tokens
      break;
    }

    if (token.type === 'literal') {
      // Skip literal characters in the input
      for (let j = 0; j < token.value.length && pos < text.length; j++) {
        pos++;
      }
      continue;
    }

    switch (token.value) {
      case 'd': {
        // 1 or 2 digit day
        const r = readDigits(text, pos, 1, 2);
        if (r === null) return null;
        day = r.value;
        pos = r.end;
        break;
      }
      case 'dd': {
        const r = readDigits(text, pos, 2, 2);
        if (r === null) return null;
        day = r.value;
        pos = r.end;
        break;
      }
      case 'ddd': {
        // Abbreviated weekday — skip but validate
        const r = readName(text, pos, DAY_NAMES_SHORT);
        if (r === null) return null;
        pos = r.end;
        break;
      }
      case 'dddd': {
        const r = readName(text, pos, DAY_NAMES_FULL);
        if (r === null) return null;
        pos = r.end;
        break;
      }

      case 'm': {
        const r = readDigits(text, pos, 1, 2);
        if (r === null) return null;
        month = r.value - 1;
        pos = r.end;
        break;
      }
      case 'mm': {
        const r = readDigits(text, pos, 2, 2);
        if (r === null) return null;
        month = r.value - 1;
        pos = r.end;
        break;
      }
      case 'mmm': {
        const r = readName(text, pos, MONTH_NAMES_SHORT);
        if (r === null) return null;
        month = r.index;
        pos = r.end;
        break;
      }
      case 'mmmm': {
        const r = readName(text, pos, MONTH_NAMES_FULL);
        if (r === null) return null;
        month = r.index;
        pos = r.end;
        break;
      }

      case 'yy': {
        const r = readDigits(text, pos, 2, 2);
        if (r === null) return null;
        // 2-digit year: 00-49 → 2000-2049, 50-99 → 1950-1999
        year = r.value < 50 ? 2000 + r.value : 1900 + r.value;
        pos = r.end;
        break;
      }
      case 'yyyy': {
        const r = readDigits(text, pos, 4, 4);
        if (r === null) return null;
        year = r.value;
        pos = r.end;
        break;
      }

      case 'H':
      case 'h': {
        const r = readDigits(text, pos, 1, 2);
        if (r === null) return null;
        hour = r.value;
        pos = r.end;
        break;
      }
      case 'HH':
      case 'hh': {
        const r = readDigits(text, pos, 2, 2);
        if (r === null) return null;
        hour = r.value;
        pos = r.end;
        break;
      }

      case 'MM': {
        const r = readDigits(text, pos, 2, 2);
        if (r === null) return null;
        minute = r.value;
        pos = r.end;
        break;
      }

      case 'ss': {
        const r = readDigits(text, pos, 2, 2);
        if (r === null) return null;
        second = r.value;
        pos = r.end;
        break;
      }

      case 'tt': {
        const remaining = text.slice(pos).toUpperCase();
        if (remaining.startsWith('PM')) {
          isPM = true;
          pos += 2;
        } else if (remaining.startsWith('AM')) {
          isPM = false;
          pos += 2;
        } else {
          return null;
        }
        break;
      }

      default:
        // Unknown pattern — skip corresponding characters
        pos += token.value.length;
        break;
    }
  }

  // Apply AM/PM
  if (isPM !== undefined) {
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
  }

  // Validate components
  if (year === -1 || month === -1 || day === -1) return null;
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;

  const date = new Date(year, month, day, hour, minute, second);

  // Verify the date is valid (e.g. Feb 30 → invalid)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/**
 * Read 1–maxLen digits from text starting at pos.
 * @internal
 */
function readDigits(
  text: string,
  pos: number,
  minLen: number,
  maxLen: number,
): { value: number; end: number } | null {
  let digits = '';
  let i = pos;

  while (i < text.length && digits.length < maxLen && text[i]! >= '0' && text[i]! <= '9') {
    digits += text[i]!;
    i++;
  }

  if (digits.length < minLen) return null;
  return { value: parseInt(digits, 10), end: i };
}

/**
 * Read a name from a list of known names (case-insensitive).
 * @internal
 */
function readName(
  text: string,
  pos: number,
  names: readonly string[],
): { index: number; end: number } | null {
  const remaining = text.slice(pos);

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    if (remaining.length >= name.length &&
        remaining.slice(0, name.length).toLowerCase() === name.toLowerCase()) {
      return { index: i, end: pos + name.length };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// AFDate_FormatEx
// ---------------------------------------------------------------------------

/**
 * Create an Acrobat-compatible date formatting function.
 *
 * The returned function takes a raw date string (which may be in
 * various formats) and returns it formatted according to the given
 * Acrobat format pattern.
 *
 * @param format  The Acrobat date format string (e.g. `"mm/dd/yyyy"`).
 * @returns       A formatting function `(value: string) => string`.
 */
export function AFDate_FormatEx(format: string): (value: string) => string {
  return (value: string): string => {
    if (typeof value !== 'string' || value.trim() === '') return '';

    // Try to parse the value as a date
    // Attempt common formats first, then fall back to Date.parse
    const date = smartParseDate(value);
    if (date === null) return value;

    return formatDate(date, format);
  };
}

// ---------------------------------------------------------------------------
// AFDate_KeystrokeEx
// ---------------------------------------------------------------------------

/**
 * Create an Acrobat-compatible date keystroke validation function.
 *
 * The returned function checks whether the current input string
 * could be a valid (partial or complete) date entry for the given format.
 *
 * @param format  The Acrobat date format string.
 * @returns       A validation function `(value: string) => boolean`.
 */
export function AFDate_KeystrokeEx(format: string): (value: string) => boolean {
  return (value: string): boolean => {
    if (typeof value !== 'string' || value.trim() === '') return true;

    // For keystroke validation, we check if the input could be a
    // partial match for the format. Each character typed should be
    // valid for its position in the format.
    const tokens = tokenizeFormat(format);
    let pos = 0;

    for (const token of tokens) {
      if (pos >= value.length) return true; // partial input is OK

      if (token.type === 'literal') {
        for (let j = 0; j < token.value.length && pos < value.length; j++) {
          // Allow the literal character or skip
          pos++;
        }
        continue;
      }

      // Pattern token — check if remaining input chars are valid
      switch (token.value) {
        case 'd':
        case 'dd':
        case 'm':
        case 'mm':
        case 'yy':
        case 'yyyy':
        case 'H':
        case 'HH':
        case 'h':
        case 'hh':
        case 'MM':
        case 'ss': {
          // Expect digits
          const expectedLen = token.value.length;
          for (let j = 0; j < expectedLen && pos < value.length; j++) {
            if (value[pos]! < '0' || value[pos]! > '9') return false;
            pos++;
          }
          break;
        }

        case 'ddd':
        case 'dddd':
        case 'mmm':
        case 'mmmm': {
          // Expect letters
          while (pos < value.length && isLetter(value[pos]!)) {
            pos++;
          }
          break;
        }

        case 'tt': {
          // Expect A/P followed by M
          if (pos < value.length) {
            const c = value[pos]!.toUpperCase();
            if (c !== 'A' && c !== 'P') return false;
            pos++;
          }
          if (pos < value.length) {
            if (value[pos]!.toUpperCase() !== 'M') return false;
            pos++;
          }
          break;
        }

        default:
          pos += token.value.length;
          break;
      }
    }

    return true;
  };
}

// ---------------------------------------------------------------------------
// Smart date parser
// ---------------------------------------------------------------------------

/**
 * Try to parse a date string in various common formats.
 *
 * Tries:
 * 1. ISO 8601: yyyy-mm-dd
 * 2. US: mm/dd/yyyy
 * 3. European: dd.mm.yyyy or dd/mm/yyyy (if day > 12)
 * 4. Named month: "Jan 5, 2025", "5 January 2025", "January 5, 2025"
 * 5. JavaScript Date.parse fallback
 *
 * @internal
 */
function smartParseDate(text: string): Date | null {
  const s = text.trim();
  if (s === '') return null;

  // Try ISO format: yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const d = new Date(
      parseInt(isoMatch[1]!, 10),
      parseInt(isoMatch[2]!, 10) - 1,
      parseInt(isoMatch[3]!, 10),
      parseInt(isoMatch[4] ?? '0', 10),
      parseInt(isoMatch[5] ?? '0', 10),
      parseInt(isoMatch[6] ?? '0', 10),
    );
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Try slash or dash separated: mm/dd/yyyy or dd/mm/yyyy
  const slashMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (slashMatch) {
    let a = parseInt(slashMatch[1]!, 10);
    let b = parseInt(slashMatch[2]!, 10);
    let yr = parseInt(slashMatch[3]!, 10);
    if (yr < 100) yr = yr < 50 ? 2000 + yr : 1900 + yr;

    let hr = parseInt(slashMatch[4] ?? '0', 10);
    const min = parseInt(slashMatch[5] ?? '0', 10);
    const sec = parseInt(slashMatch[6] ?? '0', 10);
    const ampm = slashMatch[7];
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hr < 12) hr += 12;
      if (ampm.toUpperCase() === 'AM' && hr === 12) hr = 0;
    }

    // Try mm/dd/yyyy first (US convention)
    const d1 = new Date(yr, a - 1, b, hr, min, sec);
    if (!Number.isNaN(d1.getTime()) && d1.getMonth() === a - 1 && d1.getDate() === b) {
      return d1;
    }

    // Try dd/mm/yyyy (European)
    const d2 = new Date(yr, b - 1, a, hr, min, sec);
    if (!Number.isNaN(d2.getTime()) && d2.getMonth() === b - 1 && d2.getDate() === a) {
      return d2;
    }
  }

  // Try named month formats: "Jan 5, 2025" or "5 Jan 2025" or "January 5, 2025"
  const namedMatch1 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (namedMatch1) {
    const monthIdx = findMonth(namedMatch1[1]!);
    if (monthIdx !== -1) {
      let yr = parseInt(namedMatch1[3]!, 10);
      if (yr < 100) yr = yr < 50 ? 2000 + yr : 1900 + yr;
      const d = new Date(yr, monthIdx, parseInt(namedMatch1[2]!, 10));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const namedMatch2 = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})/);
  if (namedMatch2) {
    const monthIdx = findMonth(namedMatch2[2]!);
    if (monthIdx !== -1) {
      let yr = parseInt(namedMatch2[3]!, 10);
      if (yr < 100) yr = yr < 50 ? 2000 + yr : 1900 + yr;
      const d = new Date(yr, monthIdx, parseInt(namedMatch2[1]!, 10));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  // Fallback to Date.parse
  const ts = Date.parse(s);
  if (!Number.isNaN(ts)) return new Date(ts);

  return null;
}

/**
 * Find a month index (0-based) from a month name string.
 * @internal
 */
function findMonth(name: string): number {
  const lower = name.toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (MONTH_NAMES_FULL[i]!.toLowerCase().startsWith(lower) ||
        MONTH_NAMES_SHORT[i]!.toLowerCase() === lower) {
      return i;
    }
  }
  return -1;
}

/**
 * Check if a character is a letter.
 * @internal
 */
function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}
