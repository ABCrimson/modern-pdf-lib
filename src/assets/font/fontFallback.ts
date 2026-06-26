/**
 * @module assets/font/fontFallback
 *
 * Font fallback chains with per-glyph script splitting.
 *
 * When a single font cannot cover every code point in a string (for example
 * mixed Latin + CJK text), a fallback chain resolves each code point to the
 * first font in an ordered list that can render it. Consecutive code points
 * resolving to the same font are coalesced into a single run so callers can
 * emit one text-showing operation per run instead of per glyph.
 *
 * A complementary {@link splitByScript} helper segments text into runs of a
 * single Unicode script using simple range checks. This is enough to drive
 * bidi-agnostic shaping decisions and to choose script-appropriate fonts.
 *
 * Pure logic — no font binaries are required. Coverage is expressed through
 * the caller-supplied {@link FallbackFont.covers} predicate.
 *
 * No Buffer, no fs, no require() — ESM only.
 */

/**
 * A candidate font in a fallback chain. The {@link covers} predicate reports
 * whether the font can render a given Unicode code point.
 */
export interface FallbackFont {
  /** Human-readable font identifier returned in {@link FallbackRun.font}. */
  readonly name: string;
  /** Returns `true` if this font can render the given Unicode code point. */
  readonly covers: (codepoint: number) => boolean;
}

/**
 * A contiguous slice of the input text that resolves to a single font.
 */
export interface FallbackRun {
  /** Name of the font chosen for every code point in this run. */
  readonly font: string;
  /** The text covered by this run (may include astral characters). */
  readonly text: string;
  /** Code-point index (not UTF-16 index) where this run starts. */
  readonly start: number;
}

/**
 * A contiguous slice of the input text belonging to a single Unicode script.
 */
export interface ScriptRun {
  /** Script name (e.g. `'Latin'`, `'Han'`, `'Common'`). */
  readonly script: string;
  /** The text covered by this run. */
  readonly text: string;
  /** Code-point index (not UTF-16 index) where this run starts. */
  readonly start: number;
}

/**
 * Resolve a fallback chain over `text`, code point by code point.
 *
 * For each code point the FIRST font in `fonts` whose `covers()` returns true
 * is selected. The final font in the list is treated as the ultimate fallback
 * and is used even when its `covers()` returns false, guaranteeing every code
 * point is assigned. Consecutive code points using the same font are coalesced
 * into a single {@link FallbackRun}.
 *
 * @param text  The string to resolve (iterated by Unicode code point).
 * @param fonts Ordered fallback chain; the last entry is the ultimate fallback.
 * @returns One run per maximal same-font slice, in document order.
 */
export function resolveFallback(
  text: string,
  fonts: readonly FallbackFont[],
): FallbackRun[] {
  const runs: FallbackRun[] = [];
  const ultimate = fonts.at(-1);
  if (ultimate === undefined) {
    return runs;
  }
  let index = 0;
  let current: { font: string; chars: string[]; start: number } | undefined;

  for (const ch of text) {
    const codepoint = ch.codePointAt(0) ?? 0;
    const chosen = pickFont(codepoint, fonts, ultimate);

    if (current !== undefined && current.font === chosen) {
      current.chars.push(ch);
    } else {
      if (current !== undefined) {
        runs.push({ font: current.font, text: current.chars.join(''), start: current.start });
      }
      current = { font: chosen, chars: [ch], start: index };
    }
    index += 1;
  }

  if (current !== undefined) {
    runs.push({ font: current.font, text: current.chars.join(''), start: current.start });
  }
  return runs;
}

/**
 * Pick the font for a single code point: first covering font, else ultimate.
 */
function pickFont(
  codepoint: number,
  fonts: readonly FallbackFont[],
  ultimate: FallbackFont,
): string {
  for (const font of fonts) {
    if (font.covers(codepoint)) {
      return font.name;
    }
  }
  return ultimate.name;
}

/**
 * Segment `text` into runs of a single Unicode script using simple range
 * checks. Supported scripts: Latin, Greek, Cyrillic, Arabic, Hebrew, Han,
 * Hiragana, Katakana, Hangul, and Common (everything else, including spaces,
 * digits, and punctuation).
 *
 * Consecutive code points of the same script are coalesced into one run.
 *
 * @param text The string to segment (iterated by Unicode code point).
 * @returns One {@link ScriptRun} per maximal same-script slice, in order.
 */
export function splitByScript(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let index = 0;
  let current: { script: string; chars: string[]; start: number } | undefined;

  for (const ch of text) {
    const codepoint = ch.codePointAt(0) ?? 0;
    const script = scriptOf(codepoint);

    if (current !== undefined && current.script === script) {
      current.chars.push(ch);
    } else {
      if (current !== undefined) {
        runs.push({ script: current.script, text: current.chars.join(''), start: current.start });
      }
      current = { script, chars: [ch], start: index };
    }
    index += 1;
  }

  if (current !== undefined) {
    runs.push({ script: current.script, text: current.chars.join(''), start: current.start });
  }
  return runs;
}

/**
 * Classify a single code point into one of the supported scripts.
 * Returns `'Common'` for any code point outside the known ranges.
 */
function scriptOf(cp: number): string {
  // Greek and Coptic + Greek Extended.
  if ((cp >= 0x0370 && cp <= 0x03ff) || (cp >= 0x1f00 && cp <= 0x1fff)) {
    return 'Greek';
  }
  // Cyrillic + Cyrillic Supplement.
  if (cp >= 0x0400 && cp <= 0x052f) {
    return 'Cyrillic';
  }
  // Hebrew.
  if (cp >= 0x0590 && cp <= 0x05ff) {
    return 'Hebrew';
  }
  // Arabic + Arabic Supplement.
  if ((cp >= 0x0600 && cp <= 0x06ff) || (cp >= 0x0750 && cp <= 0x077f)) {
    return 'Arabic';
  }
  // Hiragana.
  if (cp >= 0x3040 && cp <= 0x309f) {
    return 'Hiragana';
  }
  // Katakana.
  if (cp >= 0x30a0 && cp <= 0x30ff) {
    return 'Katakana';
  }
  // Hangul Jamo + Hangul Syllables.
  if ((cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0xac00 && cp <= 0xd7af)) {
    return 'Hangul';
  }
  // CJK Unified Ideographs (BMP) + Extension B (astral).
  if (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x20000 && cp <= 0x2a6df)
  ) {
    return 'Han';
  }
  // Basic Latin letters + Latin-1 / Extended-A / Extended-B letters.
  if (
    (cp >= 0x0041 && cp <= 0x005a) ||
    (cp >= 0x0061 && cp <= 0x007a) ||
    (cp >= 0x00c0 && cp <= 0x024f)
  ) {
    return 'Latin';
  }
  return 'Common';
}
