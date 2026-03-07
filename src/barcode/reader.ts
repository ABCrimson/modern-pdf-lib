/**
 * @module barcode/reader
 *
 * Barcode reader for verification purposes.
 *
 * Reads barcode data from module arrays to verify that our encoders
 * produce correct output. This is a "round-trip" verification tool,
 * not a general-purpose image scanner.
 *
 * Supported formats:
 * - Code 128 (A, B, C code sets)
 * - EAN-13
 * - EAN-8
 * - Code 39
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of a barcode read operation.
 */
export interface BarcodeReadResult {
  /** The decoded data string. */
  readonly data: string;
  /** The detected barcode format. */
  readonly format: string;
  /** Whether decoding was successful. */
  readonly valid: boolean;
  /** Whether the check digit is valid (if applicable). */
  readonly checkDigitValid?: boolean;
}

// ---------------------------------------------------------------------------
// Code 128 reader
// ---------------------------------------------------------------------------

/**
 * Code 128 bar/space width patterns for all 107 symbols (values 0-106).
 * Each pattern is 6 alternating bar/space widths (except STOP which is 7).
 */
const CODE128_PATTERNS: readonly (readonly number[])[] = [
  [2, 1, 2, 2, 2, 2], //   0
  [2, 2, 2, 1, 2, 2], //   1
  [2, 2, 2, 2, 2, 1], //   2
  [1, 2, 1, 2, 2, 3], //   3
  [1, 2, 1, 3, 2, 2], //   4
  [1, 3, 1, 2, 2, 2], //   5
  [1, 2, 2, 2, 1, 3], //   6
  [1, 2, 2, 3, 1, 2], //   7
  [1, 3, 2, 2, 1, 2], //   8
  [2, 2, 1, 2, 1, 3], //   9
  [2, 2, 1, 3, 1, 2], //  10
  [2, 3, 1, 2, 1, 2], //  11
  [1, 1, 2, 2, 3, 2], //  12
  [1, 2, 2, 1, 3, 2], //  13
  [1, 2, 2, 2, 3, 1], //  14
  [1, 1, 3, 2, 2, 2], //  15
  [1, 2, 3, 1, 2, 2], //  16
  [1, 2, 3, 2, 2, 1], //  17
  [2, 2, 3, 2, 1, 1], //  18
  [2, 2, 1, 1, 3, 2], //  19
  [2, 2, 1, 2, 3, 1], //  20
  [2, 1, 3, 2, 1, 2], //  21
  [2, 2, 3, 1, 1, 2], //  22
  [3, 1, 2, 1, 3, 1], //  23
  [3, 1, 1, 2, 2, 2], //  24
  [3, 2, 1, 1, 2, 2], //  25
  [3, 2, 1, 2, 2, 1], //  26
  [3, 1, 2, 2, 1, 2], //  27
  [3, 2, 2, 1, 1, 2], //  28
  [3, 2, 2, 2, 1, 1], //  29
  [2, 1, 2, 1, 2, 3], //  30
  [2, 1, 2, 3, 2, 1], //  31
  [2, 3, 2, 1, 2, 1], //  32
  [1, 1, 1, 3, 2, 3], //  33
  [1, 3, 1, 1, 2, 3], //  34
  [1, 3, 1, 3, 2, 1], //  35
  [1, 1, 2, 3, 1, 3], //  36
  [1, 3, 2, 1, 1, 3], //  37
  [1, 3, 2, 3, 1, 1], //  38
  [2, 1, 1, 3, 1, 3], //  39
  [2, 3, 1, 1, 1, 3], //  40
  [2, 3, 1, 3, 1, 1], //  41
  [1, 1, 2, 1, 3, 3], //  42
  [1, 1, 2, 3, 3, 1], //  43
  [1, 3, 2, 1, 3, 1], //  44
  [1, 1, 3, 1, 2, 3], //  45
  [1, 1, 3, 3, 2, 1], //  46
  [1, 3, 3, 1, 2, 1], //  47
  [3, 1, 3, 1, 2, 1], //  48
  [2, 1, 1, 3, 3, 1], //  49
  [2, 3, 1, 1, 3, 1], //  50
  [2, 1, 3, 1, 1, 3], //  51
  [2, 1, 3, 3, 1, 1], //  52
  [2, 1, 3, 1, 3, 1], //  53
  [3, 1, 1, 1, 2, 3], //  54
  [3, 1, 1, 3, 2, 1], //  55
  [3, 3, 1, 1, 2, 1], //  56
  [3, 1, 2, 1, 1, 3], //  57
  [3, 1, 2, 3, 1, 1], //  58
  [3, 3, 2, 1, 1, 1], //  59
  [3, 1, 4, 1, 1, 1], //  60
  [2, 2, 1, 4, 1, 1], //  61
  [4, 3, 1, 1, 1, 1], //  62
  [1, 1, 1, 2, 2, 4], //  63
  [1, 1, 1, 4, 2, 2], //  64
  [1, 2, 1, 1, 2, 4], //  65
  [1, 2, 1, 4, 2, 1], //  66
  [1, 4, 1, 1, 2, 2], //  67
  [1, 4, 1, 2, 2, 1], //  68
  [1, 1, 2, 2, 1, 4], //  69
  [1, 1, 2, 4, 1, 2], //  70
  [1, 2, 2, 1, 1, 4], //  71
  [1, 2, 2, 4, 1, 1], //  72
  [1, 4, 2, 1, 1, 2], //  73
  [1, 4, 2, 2, 1, 1], //  74
  [2, 4, 1, 2, 1, 1], //  75
  [2, 2, 1, 1, 1, 4], //  76
  [4, 1, 3, 1, 1, 1], //  77
  [2, 4, 1, 1, 1, 2], //  78
  [1, 3, 4, 1, 1, 1], //  79
  [1, 1, 1, 2, 4, 2], //  80
  [1, 2, 1, 1, 4, 2], //  81
  [1, 2, 1, 2, 4, 1], //  82
  [1, 1, 4, 2, 1, 2], //  83
  [1, 2, 4, 1, 1, 2], //  84
  [1, 2, 4, 2, 1, 1], //  85
  [4, 1, 1, 2, 1, 2], //  86
  [4, 2, 1, 1, 1, 2], //  87
  [4, 2, 1, 2, 1, 1], //  88
  [2, 1, 2, 1, 4, 1], //  89
  [2, 1, 4, 1, 2, 1], //  90
  [4, 1, 2, 1, 2, 1], //  91
  [1, 1, 1, 1, 4, 3], //  92
  [1, 1, 1, 3, 4, 1], //  93
  [1, 3, 1, 1, 4, 1], //  94
  [1, 1, 4, 1, 1, 3], //  95
  [1, 1, 4, 3, 1, 1], //  96
  [4, 1, 1, 1, 1, 3], //  97
  [4, 1, 1, 3, 1, 1], //  98
  [1, 1, 3, 1, 4, 1], //  99
  [1, 1, 4, 1, 3, 1], // 100  CODE B / CODE A / CODE A
  [3, 1, 1, 1, 4, 1], // 101  CODE C / CODE C / CODE B
  [4, 1, 1, 1, 3, 1], // 102  SHIFT / FNC 4
  [1, 1, 2, 3, 3, 1], // 103  START A
  [1, 1, 2, 1, 3, 3], // 104  START B
  [1, 1, 2, 1, 1, 4], // 105  START C
  [2, 3, 3, 1, 1, 1, 2], // 106  STOP (7 elements)
];

// Code 128 special values
const C128_START_A = 103;
const C128_START_B = 104;
const C128_START_C = 105;
const C128_STOP = 106;
const C128_CODE_A = 101; // When in B: switch to A; When in C: switch to A
const C128_CODE_B = 100; // When in A: switch to B; When in C: switch to B
const C128_CODE_C = 99;  // When in A or B: switch to C

// Build lookups from widths-string to symbol value for Code 128.
// We need two maps because START patterns (103-105) share the same
// bar/space widths as data symbols (43, 42, 69 respectively).
// The START-only map is used for the first symbol; the data map
// is used for all subsequent symbols.

/** Lookup for the START symbol only (includes 103-105). */
const c128StartLookup = new Map<string, number>();
for (let i = C128_START_A; i <= C128_START_C; i++) {
  c128StartLookup.set(CODE128_PATTERNS[i]!.join(','), i);
}

/** Lookup for data/check symbols (values 0-102) and STOP (106). */
const c128DataLookup = new Map<string, number>();
for (let i = 0; i <= 102; i++) {
  c128DataLookup.set(CODE128_PATTERNS[i]!.join(','), i);
}
// STOP is also needed during data scanning (7 elements)
c128DataLookup.set(CODE128_PATTERNS[C128_STOP]!.join(','), C128_STOP);

/**
 * Extract bar/space widths from a boolean module array.
 * Returns alternating widths: [bar, space, bar, space, ...] or
 * [space, bar, space, bar, ...] depending on the first module.
 */
function modulesToWidths(modules: readonly boolean[]): number[] {
  if (modules.length === 0) return [];

  const widths: number[] = [];
  let current = modules[0]!;
  let count = 1;

  for (let i = 1; i < modules.length; i++) {
    if (modules[i] === current) {
      count++;
    } else {
      widths.push(count);
      current = modules[i]!;
      count = 1;
    }
  }
  widths.push(count);
  return widths;
}

/**
 * Try to match a sequence of widths to a START symbol (values 103-105).
 */
function matchCode128Start(widths: readonly number[], offset: number): number {
  if (offset + 6 > widths.length) return -1;
  const key = widths.slice(offset, offset + 6).join(',');
  return c128StartLookup.get(key) ?? -1;
}

/**
 * Try to match a sequence of widths to a data/check symbol (values 0-102)
 * or STOP (value 106).
 */
function matchCode128Data(widths: readonly number[], offset: number, numElements: number): number {
  if (offset + numElements > widths.length) return -1;
  const key = widths.slice(offset, offset + numElements).join(',');
  return c128DataLookup.get(key) ?? -1;
}

/**
 * Convert a Code 128 symbol value to a character in Code A.
 */
function c128ValueToCharA(value: number): string {
  if (value >= 0 && value <= 63) {
    return String.fromCharCode(value + 32); // ASCII 32-95
  }
  if (value >= 64 && value <= 95) {
    return String.fromCharCode(value - 64); // ASCII 0-31
  }
  return '';
}

/**
 * Convert a Code 128 symbol value to a character in Code B.
 */
function c128ValueToCharB(value: number): string {
  if (value >= 0 && value <= 95) {
    return String.fromCharCode(value + 32); // ASCII 32-127
  }
  return '';
}

/**
 * Decode a Code 128 barcode from its module array.
 *
 * Finds the START pattern, decodes symbols according to the active
 * code set, verifies the check digit, and finds the STOP pattern.
 *
 * @param modules  Boolean array where `true` = dark bar.
 * @returns        A {@link BarcodeReadResult} with the decoded data.
 */
export function readCode128(modules: readonly boolean[]): BarcodeReadResult {
  const fail: BarcodeReadResult = { data: '', format: 'Code 128', valid: false };

  // The module array should start with a bar (true).
  // Convert modules to widths.
  const widths = modulesToWidths(modules);

  // Code 128 patterns: each symbol is 6 elements (11 modules), except STOP (7 elements, 13 modules).
  // The first symbol must be START A/B/C (103/104/105).
  if (widths.length < 6) return fail;

  // The first element in the widths array should correspond to a bar.
  // If modules[0] is false (space), we skip leading spaces.
  let widthOffset = 0;
  if (!modules[0]) {
    // Skip the leading space
    widthOffset = 1;
  }

  // Decode start symbol (6 elements) — use the START-only lookup
  const startValue = matchCode128Start(widths, widthOffset);
  if (startValue !== C128_START_A && startValue !== C128_START_B && startValue !== C128_START_C) {
    return fail;
  }

  const symbolValues: number[] = [startValue];
  widthOffset += 6;

  // Decode data symbols (6 elements each) until we find STOP (7 elements).
  // Uses the data-only lookup (values 0-102 + STOP) to avoid ambiguity
  // with START patterns that share the same bar/space widths.
  while (widthOffset < widths.length) {
    // Try STOP (7 elements) first
    const stopValue = matchCode128Data(widths, widthOffset, 7);
    if (stopValue === C128_STOP) {
      symbolValues.push(C128_STOP);
      break;
    }

    // Try regular data symbol (6 elements)
    const value = matchCode128Data(widths, widthOffset, 6);
    if (value < 0) return fail;
    symbolValues.push(value);
    widthOffset += 6;
  }

  // Must end with STOP
  if (symbolValues[symbolValues.length - 1] !== C128_STOP) return fail;

  // Must have at least: START + check + STOP = 3 symbols
  if (symbolValues.length < 3) return fail;

  // Verify check digit (second-to-last symbol, before STOP)
  const checkIdx = symbolValues.length - 2;
  const storedCheck = symbolValues[checkIdx]!;

  let checkSum = symbolValues[0]!;
  for (let i = 1; i < checkIdx; i++) {
    checkSum += symbolValues[i]! * i;
  }
  const computedCheck = checkSum % 103;
  const checkDigitValid = storedCheck === computedCheck;

  // Decode data symbols (between START and check digit)
  let codeSet: 'A' | 'B' | 'C' =
    startValue === C128_START_A ? 'A' :
    startValue === C128_START_B ? 'B' : 'C';

  let data = '';
  for (let i = 1; i < checkIdx; i++) {
    const val = symbolValues[i]!;

    // Handle code-set switching
    if (codeSet === 'A' || codeSet === 'B') {
      if (val === C128_CODE_C) { // 99
        codeSet = 'C';
        continue;
      }
    }
    if (codeSet === 'A') {
      if (val === C128_CODE_B) { // 100
        codeSet = 'B';
        continue;
      }
    }
    if (codeSet === 'B') {
      if (val === C128_CODE_A) { // 101 in Code B context means switch to Code A
        codeSet = 'A';
        continue;
      }
    }
    if (codeSet === 'C') {
      if (val === C128_CODE_B) { // 100 in Code C context means switch to Code B
        codeSet = 'B';
        continue;
      }
      if (val === C128_CODE_A) { // 101 in Code C context means switch to Code A
        // NOTE: In Code C, value 100 = CODE B, value 101 = CODE A
        // But in our encoder, CODE_A = 101 when in Code C
        codeSet = 'A';
        continue;
      }
    }

    // Decode value in current code set
    if (codeSet === 'A') {
      data += c128ValueToCharA(val);
    } else if (codeSet === 'B') {
      data += c128ValueToCharB(val);
    } else {
      // Code C: value is a two-digit number 00-99
      if (val >= 0 && val <= 99) {
        data += val.toString().padStart(2, '0');
      }
    }
  }

  return { data, format: 'Code 128', valid: checkDigitValid, checkDigitValid };
}

// ---------------------------------------------------------------------------
// EAN-13 reader
// ---------------------------------------------------------------------------

/**
 * L-code patterns for digits 0-9 (7 modules each).
 * Each string is '0'=space, '1'=bar.
 */
const EAN_L: readonly string[] = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];

/** G-code patterns. */
const EAN_G: readonly string[] = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];

/** R-code patterns. */
const EAN_R: readonly string[] = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];

/** First-digit parity encodings for EAN-13. */
const PARITY_PATTERNS: readonly string[] = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

/** Build lookup maps from 7-module pattern to digit. */
function buildEanLookup(patterns: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < patterns.length; i++) {
    map.set(patterns[i]!, i);
  }
  return map;
}

const L_LOOKUP = buildEanLookup(EAN_L);
const G_LOOKUP = buildEanLookup(EAN_G);
const R_LOOKUP = buildEanLookup(EAN_R);

/**
 * Convert a section of boolean modules to a pattern string.
 */
function modulesToPattern(modules: readonly boolean[], start: number, length: number): string {
  let s = '';
  for (let i = start; i < start + length; i++) {
    s += modules[i] ? '1' : '0';
  }
  return s;
}

/**
 * Calculate the EAN/UPC check digit using the Modulo-10 algorithm.
 */
function calculateEanCheck(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[i]);
    const weight = ((digits.length - 1 - i) % 2 === 0) ? 3 : 1;
    sum += digit * weight;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Decode an EAN-13 barcode from its module array.
 *
 * EAN-13 structure (95 modules total):
 * - Start guard: 3 modules (101)
 * - Left digits (6 x 7 modules): 42 modules
 * - Center guard: 5 modules (01010)
 * - Right digits (6 x 7 modules): 42 modules
 * - End guard: 3 modules (101)
 *
 * @param modules  Boolean array of 95 modules.
 * @returns        A {@link BarcodeReadResult}.
 */
export function readEan13(modules: readonly boolean[]): BarcodeReadResult {
  const fail: BarcodeReadResult = { data: '', format: 'EAN-13', valid: false };

  if (modules.length !== 95) return fail;

  // Verify start guard: 101
  if (!modules[0] || modules[1] || !modules[2]) return fail;

  // Verify center guard at position 45: 01010
  if (modules[45] || !modules[46] || modules[47] || !modules[48] || modules[49]) return fail;

  // Verify end guard: 101
  if (!modules[92] || modules[93] || !modules[94]) return fail;

  // Decode left-side digits (positions 3-44, six 7-module groups)
  const leftDigits: number[] = [];
  const leftParity: string[] = []; // 'L' or 'G' for each left digit
  for (let i = 0; i < 6; i++) {
    const pattern = modulesToPattern(modules, 3 + i * 7, 7);
    const lDigit = L_LOOKUP.get(pattern);
    const gDigit = G_LOOKUP.get(pattern);
    if (lDigit !== undefined) {
      leftDigits.push(lDigit);
      leftParity.push('L');
    } else if (gDigit !== undefined) {
      leftDigits.push(gDigit);
      leftParity.push('G');
    } else {
      return fail;
    }
  }

  // Decode right-side digits (positions 50-91, six 7-module groups)
  const rightDigits: number[] = [];
  for (let i = 0; i < 6; i++) {
    const pattern = modulesToPattern(modules, 50 + i * 7, 7);
    const digit = R_LOOKUP.get(pattern);
    if (digit === undefined) return fail;
    rightDigits.push(digit);
  }

  // Determine the first digit from the left parity pattern
  const parityStr = leftParity.join('');
  let firstDigit = -1;
  for (let d = 0; d < 10; d++) {
    if (PARITY_PATTERNS[d] === parityStr) {
      firstDigit = d;
      break;
    }
  }
  if (firstDigit < 0) return fail;

  // Build the full 13-digit string
  const allDigits = [firstDigit, ...leftDigits, ...rightDigits];
  const data = allDigits.join('');

  // Validate check digit (last digit)
  const dataWithoutCheck = data.slice(0, 12);
  const expectedCheck = calculateEanCheck(dataWithoutCheck);
  const checkDigitValid = allDigits[12] === expectedCheck;

  return { data, format: 'EAN-13', valid: checkDigitValid, checkDigitValid };
}

/**
 * Decode an EAN-8 barcode from its module array.
 *
 * EAN-8 structure (67 modules total):
 * - Start guard: 3 modules (101)
 * - Left digits (4 x 7 modules, L patterns): 28 modules
 * - Center guard: 5 modules (01010)
 * - Right digits (4 x 7 modules, R patterns): 28 modules
 * - End guard: 3 modules (101)
 *
 * @param modules  Boolean array of 67 modules.
 * @returns        A {@link BarcodeReadResult}.
 */
export function readEan8(modules: readonly boolean[]): BarcodeReadResult {
  const fail: BarcodeReadResult = { data: '', format: 'EAN-8', valid: false };

  if (modules.length !== 67) return fail;

  // Verify start guard: 101
  if (!modules[0] || modules[1] || !modules[2]) return fail;

  // Verify center guard at position 31: 01010
  if (modules[31] || !modules[32] || modules[33] || !modules[34] || modules[35]) return fail;

  // Verify end guard: 101
  if (!modules[64] || modules[65] || !modules[66]) return fail;

  // Decode left-side digits (positions 3-30, four 7-module groups, all L patterns)
  const leftDigits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const pattern = modulesToPattern(modules, 3 + i * 7, 7);
    const digit = L_LOOKUP.get(pattern);
    if (digit === undefined) return fail;
    leftDigits.push(digit);
  }

  // Decode right-side digits (positions 36-63, four 7-module groups, all R patterns)
  const rightDigits: number[] = [];
  for (let i = 0; i < 4; i++) {
    const pattern = modulesToPattern(modules, 36 + i * 7, 7);
    const digit = R_LOOKUP.get(pattern);
    if (digit === undefined) return fail;
    rightDigits.push(digit);
  }

  const allDigits = [...leftDigits, ...rightDigits];
  const data = allDigits.join('');

  // Validate check digit
  const dataWithoutCheck = data.slice(0, 7);
  const expectedCheck = calculateEanCheck(dataWithoutCheck);
  const checkDigitValid = allDigits[7] === expectedCheck;

  return { data, format: 'EAN-8', valid: checkDigitValid, checkDigitValid };
}

// ---------------------------------------------------------------------------
// Code 39 reader
// ---------------------------------------------------------------------------

/**
 * Code 39 character set.
 */
const CODE39_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';

/**
 * Code 39 element-width patterns (9 elements: bar, space, bar, space, bar, space, bar, space, bar).
 * 1 = narrow, 2 = wide.
 */
const CODE39_WIDTHS: readonly (readonly number[])[] = [
  [1, 1, 1, 2, 2, 1, 2, 1, 1], //  0
  [2, 1, 1, 2, 1, 1, 1, 1, 2], //  1
  [1, 1, 2, 2, 1, 1, 1, 1, 2], //  2
  [2, 1, 2, 2, 1, 1, 1, 1, 1], //  3
  [1, 1, 1, 2, 2, 1, 1, 1, 2], //  4
  [2, 1, 1, 2, 2, 1, 1, 1, 1], //  5
  [1, 1, 2, 2, 2, 1, 1, 1, 1], //  6
  [1, 1, 1, 2, 1, 1, 2, 1, 2], //  7
  [2, 1, 1, 2, 1, 1, 2, 1, 1], //  8
  [1, 1, 2, 2, 1, 1, 2, 1, 1], //  9
  [2, 1, 1, 1, 1, 2, 1, 1, 2], // 10 A
  [1, 1, 2, 1, 1, 2, 1, 1, 2], // 11 B
  [2, 1, 2, 1, 1, 2, 1, 1, 1], // 12 C
  [1, 1, 1, 1, 2, 2, 1, 1, 2], // 13 D
  [2, 1, 1, 1, 2, 2, 1, 1, 1], // 14 E
  [1, 1, 2, 1, 2, 2, 1, 1, 1], // 15 F
  [1, 1, 1, 1, 1, 2, 2, 1, 2], // 16 G
  [2, 1, 1, 1, 1, 2, 2, 1, 1], // 17 H
  [1, 1, 2, 1, 1, 2, 2, 1, 1], // 18 I
  [1, 1, 1, 1, 2, 2, 2, 1, 1], // 19 J
  [2, 1, 1, 1, 1, 1, 1, 2, 2], // 20 K
  [1, 1, 2, 1, 1, 1, 1, 2, 2], // 21 L
  [2, 1, 2, 1, 1, 1, 1, 2, 1], // 22 M
  [1, 1, 1, 1, 2, 1, 1, 2, 2], // 23 N
  [2, 1, 1, 1, 2, 1, 1, 2, 1], // 24 O
  [1, 1, 2, 1, 2, 1, 1, 2, 1], // 25 P
  [1, 1, 1, 1, 1, 1, 2, 2, 2], // 26 Q
  [2, 1, 1, 1, 1, 1, 2, 2, 1], // 27 R
  [1, 1, 2, 1, 1, 1, 2, 2, 1], // 28 S
  [1, 1, 1, 1, 2, 1, 2, 2, 1], // 29 T
  [2, 2, 1, 1, 1, 1, 1, 1, 2], // 30 U
  [1, 2, 2, 1, 1, 1, 1, 1, 2], // 31 V
  [2, 2, 2, 1, 1, 1, 1, 1, 1], // 32 W
  [1, 2, 1, 1, 2, 1, 1, 1, 2], // 33 X
  [2, 2, 1, 1, 2, 1, 1, 1, 1], // 34 Y
  [1, 2, 2, 1, 2, 1, 1, 1, 1], // 35 Z
  [1, 2, 1, 1, 1, 1, 2, 1, 2], // 36 -
  [2, 2, 1, 1, 1, 1, 2, 1, 1], // 37 .
  [1, 2, 2, 1, 1, 1, 2, 1, 1], // 38 (space)
  [1, 2, 1, 2, 1, 2, 1, 1, 1], // 39 $
  [1, 2, 1, 2, 1, 1, 1, 2, 1], // 40 /
  [1, 2, 1, 1, 1, 2, 1, 2, 1], // 41 +
  [1, 1, 1, 2, 1, 2, 1, 2, 1], // 42 %
  [1, 2, 1, 1, 2, 1, 2, 1, 1], // 43 *
];

/**
 * Try to classify module widths in a Code 39 character into narrow/wide.
 *
 * Because the wide-to-narrow ratio can vary, we need to dynamically determine
 * the threshold. We take the 9 widths for a character, sort them, and use the
 * gap between the 6th and 7th smallest as the cutoff (3 wide + 6 narrow).
 */
function classifyCode39Widths(widths: readonly number[]): number[] | null {
  if (widths.length !== 9) return null;

  // Find the threshold: 6 narrow and 3 wide elements
  const sorted = [...widths].sort((a, b) => a - b);
  // The threshold is the average of the largest narrow and smallest wide
  const threshold = (sorted[5]! + sorted[6]!) / 2;

  const classified: number[] = [];
  for (const w of widths) {
    classified.push(w <= threshold ? 1 : 2);
  }
  return classified;
}

/**
 * Match classified widths to a Code 39 character.
 */
function matchCode39Char(classified: readonly number[]): number {
  const key = classified.join(',');
  for (let i = 0; i < CODE39_WIDTHS.length; i++) {
    if (CODE39_WIDTHS[i]!.join(',') === key) return i;
  }
  return -1;
}

/**
 * Decode a Code 39 barcode from its module array.
 *
 * The reader dynamically determines the wide/narrow threshold from
 * the module widths, making it robust to different ratios.
 *
 * @param modules  Boolean array where `true` = dark bar.
 * @returns        A {@link BarcodeReadResult} with the decoded data.
 */
export function readCode39(modules: readonly boolean[]): BarcodeReadResult {
  const fail: BarcodeReadResult = { data: '', format: 'Code 39', valid: false };

  if (modules.length === 0) return fail;

  // Convert to run-length widths
  const widths = modulesToWidths(modules);

  // Code 39 structure:
  // - Characters are 9 elements (bar/space alternating, starting with bar)
  // - Characters are separated by 1-element narrow spaces
  // - Starts and ends with '*'

  // The first run should be a bar
  if (!modules[0]) return fail;

  // Group widths into character groups of 9, separated by single-width gaps
  const charGroups: number[][] = [];
  let idx = 0;

  while (idx + 9 <= widths.length) {
    charGroups.push(widths.slice(idx, idx + 9));
    idx += 9;
    // Skip the inter-character gap (1 narrow space)
    if (idx < widths.length) {
      idx += 1;
    }
  }

  if (charGroups.length < 2) return fail; // Need at least start + stop

  // Classify and decode each character
  const decoded: number[] = [];
  for (const group of charGroups) {
    const classified = classifyCode39Widths(group);
    if (!classified) return fail;
    const charIdx = matchCode39Char(classified);
    if (charIdx < 0) return fail;
    decoded.push(charIdx);
  }

  // First and last must be '*' (index 43)
  if (decoded[0] !== 43 || decoded[decoded.length - 1] !== 43) return fail;

  // Extract data (between the start and stop asterisks)
  const dataIndices = decoded.slice(1, -1);
  const data = dataIndices.map((i) => CODE39_CHARS[i]!).join('');

  return { data, format: 'Code 39', valid: true };
}

// ---------------------------------------------------------------------------
// Auto-detect reader
// ---------------------------------------------------------------------------

/**
 * Auto-detect barcode format and decode.
 *
 * Tries multiple decoders and returns the first successful result,
 * or `null` if no format matches.
 *
 * Detection order:
 * 1. EAN-13 (95 modules)
 * 2. EAN-8 (67 modules)
 * 3. Code 128 (starts with a known START pattern)
 * 4. Code 39 (starts and ends with '*' pattern)
 *
 * @param modules  Boolean array where `true` = dark bar.
 * @returns        A {@link BarcodeReadResult} or `null` if unrecognised.
 */
export function readBarcode(modules: readonly boolean[]): BarcodeReadResult | null {
  // Try EAN-13 (exactly 95 modules)
  if (modules.length === 95) {
    const result = readEan13(modules);
    if (result.valid) return result;
  }

  // Try EAN-8 (exactly 67 modules)
  if (modules.length === 67) {
    const result = readEan8(modules);
    if (result.valid) return result;
  }

  // Try Code 128
  {
    const result = readCode128(modules);
    if (result.valid) return result;
  }

  // Try Code 39
  {
    const result = readCode39(modules);
    if (result.valid) return result;
  }

  return null;
}
