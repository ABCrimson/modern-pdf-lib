/**
 * Tests for the Unicode Bidirectional Algorithm (UAX #9) implementation in
 * src/text/bidi.ts.
 *
 * Real codepoints used (verified against the Unicode 16.0 UCD DerivedBidiClass):
 *  - Hebrew letters U+05D0..U+05EA  → Bidi_Class "R"   (strong right-to-left)
 *      א U+05D0 ALEF, ב U+05D1 BET, ג U+05D2 GIMEL, ם U+05DD FINAL MEM,
 *      ל U+05DC LAMED, ו U+05D5 VAV, ש U+05E9 SHIN.
 *  - Arabic letters U+0600.. range → Bidi_Class "AL"  (Arabic letter)
 *      ا U+0627 ALEF, ب U+0628 BEH, ج U+062C JEEM, د U+062F DAL.
 *  - European digits "0".."9"        → Bidi_Class "EN"
 *  - Arabic-Indic digits U+0660..    → Bidi_Class "AN"
 *  - Latin letters                   → Bidi_Class "L"
 */

import { describe, it, expect } from 'vitest';
import { resolveBidi, reorderVisual } from '../../../src/text/bidi.js';
import type { BidiResult } from '../../../src/text/bidi.js';

// ---------------------------------------------------------------------------
// Codepoint constants
// ---------------------------------------------------------------------------

const ALEF = 'א'; // Hebrew א (R)
const BET = 'ב'; // Hebrew ב (R)
const GIMEL = 'ג'; // Hebrew ג (R)
const SHALOM = 'שלום'; // שלום "shalom" (all R)

const AR_ALEF = 'ا'; // Arabic ا (AL)
const AR_BEH = 'ب'; // Arabic ب (AL)
const AR_JEEM = 'ج'; // Arabic ج (AL)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The substring at each visual position, joined back into a visual string. */
function visualString(text: string, result: BidiResult): string {
  return result.visualOrder.map((i) => text[i]).join('');
}

// ---------------------------------------------------------------------------
// P2/P3 — paragraph base level
// ---------------------------------------------------------------------------

describe('resolveBidi — paragraph base level (P2/P3)', () => {
  it('pure-LTR ASCII yields base level 0, one ltr run, identity visual order', () => {
    const text = 'hello world';
    const res = resolveBidi(text);

    expect(res.baseLevel).toBe(0);
    expect(res.runs).toHaveLength(1);
    expect(res.runs[0]?.direction).toBe('ltr');
    expect(res.runs[0]?.level).toBe(0);
    expect(res.runs[0]?.text).toBe(text);
    expect(res.runs[0]?.start).toBe(0);
    expect(res.runs[0]?.length).toBe(text.length);

    // Identity visual order.
    expect(res.visualOrder).toEqual(Array.from({ length: text.length }, (_, i) => i));
    expect(res.levels.every((l) => l === 0)).toBe(true);
  });

  it("'auto' base picks RTL when the first strong char is Hebrew", () => {
    const text = `${SHALOM}`;
    const res = resolveBidi(text, 'auto');
    expect(res.baseLevel).toBe(1);
  });

  it("explicit base 'rtl' forces base level 1 even for ASCII", () => {
    const res = resolveBidi('abc', 'rtl');
    expect(res.baseLevel).toBe(1);
  });

  it("explicit base 'ltr' forces base level 0 even for Hebrew", () => {
    const res = resolveBidi(SHALOM, 'ltr');
    expect(res.baseLevel).toBe(0);
  });

  it("'auto' with a leading neutral skips to the first strong char", () => {
    // Leading spaces/punctuation are neutral; first strong is Hebrew → RTL.
    const res = resolveBidi(`  ${ALEF}${BET}`, 'auto');
    expect(res.baseLevel).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Mixed direction — Hebrew word inside an LTR sentence
// ---------------------------------------------------------------------------

describe('resolveBidi — RTL run inside LTR context', () => {
  const text = `abc ${ALEF}${BET}${GIMEL} xyz`;
  //            0123 4  5  6    789
  const res = resolveBidi(text);

  it('keeps the paragraph LTR (base level 0)', () => {
    expect(res.baseLevel).toBe(0);
  });

  it('assigns the Hebrew characters an odd (RTL) level', () => {
    const idxAlef = text.indexOf(ALEF);
    const idxBet = text.indexOf(BET);
    const idxGimel = text.indexOf(GIMEL);
    expect(res.levels[idxAlef]! % 2).toBe(1);
    expect(res.levels[idxBet]! % 2).toBe(1);
    expect(res.levels[idxGimel]! % 2).toBe(1);
  });

  it('keeps the Latin characters even (LTR) level 0', () => {
    expect(res.levels[0]).toBe(0); // 'a'
    expect(res.levels[1]).toBe(0); // 'b'
    expect(res.levels[2]).toBe(0); // 'c'
  });

  it('reverses the Hebrew run in visual order while Latin stays in place', () => {
    // The Hebrew logical order is ALEF, BET, GIMEL; reversed visually.
    const visual = visualString(text, res);
    expect(visual.startsWith('abc ')).toBe(true);
    expect(visual.endsWith(' xyz')).toBe(true);
    // The Hebrew substring appears reversed.
    expect(visual).toContain(`${GIMEL}${BET}${ALEF}`);
  });

  it('produces a contiguous RTL run for the Hebrew word', () => {
    const heRun = res.runs.find((r) => r.direction === 'rtl');
    expect(heRun).toBeDefined();
    expect(heRun!.level % 2).toBe(1);
    expect(heRun?.text).toBe(`${ALEF}${BET}${GIMEL}`);
  });
});

// ---------------------------------------------------------------------------
// All-RTL with base 'rtl'
// ---------------------------------------------------------------------------

describe('resolveBidi — all-RTL paragraph', () => {
  it('Hebrew-only string with base rtl has base level 1 and one rtl run', () => {
    const res = resolveBidi(SHALOM, 'rtl');
    expect(res.baseLevel).toBe(1);
    const rtlRuns = res.runs.filter((r) => r.direction === 'rtl');
    expect(rtlRuns).toHaveLength(1);
    expect(rtlRuns[0]?.level).toBe(1);
    // Pure RTL → fully reversed visual order.
    expect(res.visualOrder).toEqual(Array.from({ length: SHALOM.length }, (_, i) => SHALOM.length - 1 - i));
  });

  it('Arabic-only string auto-detects RTL base level 1', () => {
    const res = resolveBidi(`${AR_ALEF}${AR_BEH}${AR_JEEM}`, 'auto');
    expect(res.baseLevel).toBe(1);
    expect(res.runs.every((r) => r.direction === 'rtl')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// W rules — digits inside Arabic
// ---------------------------------------------------------------------------

describe('resolveBidi — weak types (W2/W7) digits in Arabic', () => {
  it('European digits after an Arabic letter resolve to AN → even+1 level', () => {
    // W2: EN after strong AL becomes AN. In an RTL paragraph AN gets an even
    // level (level base+2). Hebrew letters are odd (base+1). So the digits sit
    // on a *different*, even level than the surrounding Arabic letters.
    const text = `${AR_ALEF}${AR_BEH}12`;
    const res = resolveBidi(text, 'rtl');
    expect(res.baseLevel).toBe(1);

    const idxArab = 0;
    const idxDigit = text.indexOf('1');
    // Arabic letters: odd level (RTL).
    expect(res.levels[idxArab]! % 2).toBe(1);
    // Digits (resolved to AN via W2): even level.
    expect(res.levels[idxDigit]! % 2).toBe(0);
    expect(res.levels[idxDigit + 1]! % 2).toBe(0);
    // The two digits keep ascending logical order within their own run
    // (numbers are not individually reversed).
    const visual = visualString(text, res);
    expect(visual).toContain('12');
  });

  it('European digits in a Latin (LTR) context stay EN at level 0', () => {
    const text = 'abc123';
    const res = resolveBidi(text);
    expect(res.baseLevel).toBe(0);
    expect(res.levels.every((l) => l === 0)).toBe(true);
    expect(res.visualOrder).toEqual(Array.from({ length: text.length }, (_, i) => i));
  });
});

// ---------------------------------------------------------------------------
// reorderVisual convenience
// ---------------------------------------------------------------------------

describe('reorderVisual', () => {
  it('is the identity for pure ASCII', () => {
    expect(reorderVisual('hello')).toBe('hello');
  });

  it('reverses a pure Hebrew string', () => {
    expect(reorderVisual(SHALOM, 'rtl')).toBe(Array.from(SHALOM).reverse().join(''));
  });

  it('reverses only the embedded Hebrew word in an LTR sentence', () => {
    const text = `abc ${ALEF}${BET}${GIMEL} xyz`;
    const out = reorderVisual(text);
    expect(out.startsWith('abc ')).toBe(true);
    expect(out.endsWith(' xyz')).toBe(true);
    expect(out).toContain(`${GIMEL}${BET}${ALEF}`);
  });
});

// ---------------------------------------------------------------------------
// Run partitioning invariants
// ---------------------------------------------------------------------------

describe('resolveBidi — run invariants', () => {
  it('runs cover the whole string contiguously and in logical order', () => {
    const text = `abc ${ALEF}${BET} 99 xyz`;
    const res = resolveBidi(text);
    let cursor = 0;
    let reconstructed = '';
    for (const run of res.runs) {
      expect(run.start).toBe(cursor);
      expect(run.length).toBe(run.text.length);
      reconstructed += run.text;
      cursor += run.length;
    }
    expect(reconstructed).toBe(text);
    expect(cursor).toBe(text.length);
  });

  it('levels array length equals the string length', () => {
    const text = `abc ${ALEF}${BET}${GIMEL} xyz`;
    const res = resolveBidi(text);
    expect(res.levels).toHaveLength(text.length);
    expect(res.visualOrder).toHaveLength(text.length);
  });

  it('every run direction matches the parity of its level', () => {
    const text = `${AR_ALEF}${AR_BEH} hi 7`;
    const res = resolveBidi(text, 'rtl');
    for (const run of res.runs) {
      expect(run.direction).toBe(run.level % 2 === 0 ? 'ltr' : 'rtl');
    }
  });
});
