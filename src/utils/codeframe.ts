/**
 * @module utils/codeframe
 *
 * Developer-experience helpers for producing friendly diagnostics:
 *
 * - {@link renderCodeFrame} renders a source excerpt with line-number gutters
 *   and a caret pointing at an offending column (in the style of Babel /
 *   TypeScript error frames).
 * - {@link levenshtein} computes the classic edit distance between two strings.
 * - {@link didYouMean} suggests the closest candidate to a misspelled input,
 *   used to power "did you mean …?" hints on unknown identifiers.
 *
 * Pure TypeScript with no runtime dependencies; safe in every supported
 * runtime (Node 25+, Deno, Bun, Cloudflare Workers, browsers).
 */

/**
 * Options for {@link renderCodeFrame}.
 */
export interface CodeFrameOptions {
  /**
   * Number of context lines to show before and after the target line.
   * Defaults to `2`.
   */
  readonly contextLines?: number | undefined;
}

/**
 * Render a code frame: an excerpt of `source` centered on a 1-based
 * `line`/`column`, with a line-number gutter and a caret (`^`) underneath the
 * target column.
 *
 * Lines outside the available source range are clamped. A non-positive
 * `contextLines` shows only the target line itself.
 *
 * @param source   The full source text.
 * @param line     The 1-based line number to highlight.
 * @param column   The 1-based column number to point the caret at.
 * @param options  Optional rendering options.
 * @returns        A multi-line string ready to print in a diagnostic.
 */
export function renderCodeFrame(
  source: string,
  line: number,
  column: number,
  options?: CodeFrameOptions,
): string {
  const contextLines = Math.max(0, options?.contextLines ?? 2);
  const lines = source.split('\n');
  const lineCount = lines.length;

  // Clamp the target line into the valid 1-based range.
  const targetLine = Math.min(Math.max(1, Math.trunc(line)), lineCount);

  const start = Math.max(1, targetLine - contextLines);
  const end = Math.min(lineCount, targetLine + contextLines);

  // Width of the widest line number in the rendered window.
  const gutterWidth = String(end).length;

  const out: string[] = [];
  for (let n = start; n <= end; n++) {
    const content = lines[n - 1] ?? '';
    const isTarget = n === targetLine;
    const marker = isTarget ? '>' : ' ';
    const gutter = String(n).padStart(gutterWidth, ' ');
    out.push(`${marker} ${gutter} | ${content}`);

    if (isTarget) {
      // Caret line: blank gutter, then spaces up to the 1-based column.
      const caretColumn = Math.max(1, Math.trunc(column));
      const padding = ' '.repeat(caretColumn - 1);
      const blankGutter = ' '.repeat(gutterWidth);
      out.push(`  ${blankGutter} | ${padding}^`);
    }
  }

  return out.join('\n');
}

/**
 * Compute the Levenshtein edit distance between two strings: the minimum
 * number of single-character insertions, deletions, or substitutions required
 * to transform `a` into `b`.
 *
 * @param a  The first string.
 * @param b  The second string.
 * @returns  The edit distance (`>= 0`).
 */
export function levenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) {
    return bLen;
  }
  if (bLen === 0) {
    return aLen;
  }

  // Two-row dynamic programming over the edit-distance matrix.
  let previous: number[] = new Array<number>(bLen + 1);
  let current: number[] = new Array<number>(bLen + 1);

  for (let j = 0; j <= bLen; j++) {
    previous[j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    current[0] = i;
    const aChar = a.charCodeAt(i - 1);

    for (let j = 1; j <= bLen; j++) {
      const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(deletion, insertion, substitution);
    }

    // Swap the rows for the next iteration.
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[bLen] ?? 0;
}

/**
 * Suggest the closest candidate to `input` from a list of `candidates`,
 * useful for "did you mean …?" hints.
 *
 * The accepted distance is the smaller of `maxDistance` and a value scaled to
 * the length of `input` (roughly one third of its length, with a minimum of
 * one), so short identifiers do not match wildly different strings.
 *
 * @param input        The (possibly misspelled) string.
 * @param candidates   The known valid strings.
 * @param maxDistance  The hard upper bound on edit distance. Defaults to `3`.
 * @returns            The closest candidate within range, or `undefined`.
 */
export function didYouMean(
  input: string,
  candidates: readonly string[],
  maxDistance: number = 3,
): string | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  // Scale the threshold to the input length so short tokens stay strict,
  // but never exceed the caller-provided hard bound.
  const scaled = Math.max(1, Math.floor(input.length / 3));
  const threshold = Math.min(maxDistance, scaled);

  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate === input) {
      return candidate;
    }
    const distance = levenshtein(input, candidate);
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}
