/**
 * Tests for the developer-experience code-frame utility module.
 *
 * Covers code-frame rendering (caret placement, neighbour lines, line-number
 * gutters, clamping, context-line control), Levenshtein edit distance, and
 * "did you mean …?" suggestions.
 */

import { describe, it, expect } from 'vitest';
import {
  renderCodeFrame,
  levenshtein,
  didYouMean,
  type CodeFrameOptions,
} from '../../../src/utils/codeframe.js';

// ---------------------------------------------------------------------------
// renderCodeFrame
// ---------------------------------------------------------------------------

describe('renderCodeFrame', () => {
  const source = ['line one', 'line two', 'line three', 'line four', 'line five'].join('\n');

  it('points the caret at the right column and includes neighbour lines', () => {
    // Target column 6 on line 3 ("line three" -> caret under 't' of "three").
    const frame = renderCodeFrame(source, 3, 6);
    const out = frame.split('\n');

    // Neighbour lines (1 before + 1 after the default context of 2) present.
    expect(frame).toContain('line one');
    expect(frame).toContain('line two');
    expect(frame).toContain('line three');
    expect(frame).toContain('line four');
    expect(frame).toContain('line five');

    // Line numbers appear in the gutter.
    expect(frame).toContain('1 |');
    expect(frame).toContain('3 |');
    expect(frame).toContain('5 |');

    // The target line is marked with '>'.
    const targetRow = out.find((row) => row.includes('line three'));
    expect(targetRow).toBeDefined();
    expect(targetRow?.startsWith('>')).toBe(true);

    // The caret row sits directly below the target row.
    const targetIndex = out.findIndex((row) => row.includes('line three'));
    const caretRow = out[targetIndex + 1];
    expect(caretRow).toBeDefined();
    expect(caretRow).toContain('^');

    // The caret is under column 6: locate the content column on the target
    // row and the caret column on the caret row; they must match.
    const contentColumn = (targetRow ?? '').indexOf('line three') + 5; // 5 chars before 'three'
    const caretColumn = (caretRow ?? '').indexOf('^');
    expect(caretColumn).toBe(contentColumn);
  });

  it('respects a custom contextLines count', () => {
    const opts: CodeFrameOptions = { contextLines: 1 };
    const frame = renderCodeFrame(source, 3, 1, opts);
    expect(frame).toContain('line two');
    expect(frame).toContain('line three');
    expect(frame).toContain('line four');
    // Out-of-window lines are excluded.
    expect(frame).not.toContain('line one');
    expect(frame).not.toContain('line five');
  });

  it('shows only the target line when contextLines is zero', () => {
    const frame = renderCodeFrame(source, 2, 1, { contextLines: 0 });
    expect(frame).toContain('line two');
    expect(frame).not.toContain('line one');
    expect(frame).not.toContain('line three');
    // Target line plus its caret line only.
    expect(frame.split('\n')).toHaveLength(2);
  });

  it('clamps an out-of-range line to the available source', () => {
    const frame = renderCodeFrame(source, 999, 1);
    // Clamps to the last line (5).
    expect(frame).toContain('line five');
    const out = frame.split('\n');
    const targetRow = out.find((row) => row.startsWith('>'));
    expect(targetRow).toContain('line five');
  });

  it('handles a single-line source', () => {
    const frame = renderCodeFrame('hello world', 1, 7);
    const out = frame.split('\n');
    expect(out[0].startsWith('>')).toBe(true);
    expect(out[0]).toContain('hello world');
    expect(out[1]).toContain('^');
    // Caret under column 7 ('w' of "world").
    const contentColumn = out[0].indexOf('hello world') + 6;
    expect(out[1].indexOf('^')).toBe(contentColumn);
  });

  it('widens the gutter for multi-digit line numbers', () => {
    const big = Array.from({ length: 12 }, (_, i) => `row ${i + 1}`).join('\n');
    const frame = renderCodeFrame(big, 10, 1, { contextLines: 1 });
    // Two-digit line numbers should be present and aligned.
    expect(frame).toContain('10 |');
    expect(frame).toContain(' 9 |');
  });
});

// ---------------------------------------------------------------------------
// levenshtein
// ---------------------------------------------------------------------------

describe('levenshtein', () => {
  it('matches the classic kitten/sitting example (3)', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('returns 0 for identical strings', () => {
    expect(levenshtein('embedFont', 'embedFont')).toBe(0);
  });

  it('returns the length when one side is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('', '')).toBe(0);
  });

  it('counts a single substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('counts a single insertion and deletion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1);
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('is symmetric', () => {
    expect(levenshtein('flaw', 'lawn')).toBe(levenshtein('lawn', 'flaw'));
  });
});

// ---------------------------------------------------------------------------
// didYouMean
// ---------------------------------------------------------------------------

describe('didYouMean', () => {
  it('suggests the closest candidate within range', () => {
    expect(didYouMean('embedFnt', ['embedFont', 'embedPng'])).toBe('embedFont');
  });

  it('returns undefined when nothing is close enough', () => {
    expect(didYouMean('zzz', ['embedFont'])).toBeUndefined();
  });

  it('returns an exact match', () => {
    expect(didYouMean('embedFont', ['embedFont', 'embedPng'])).toBe('embedFont');
  });

  it('returns undefined for an empty candidate list', () => {
    expect(didYouMean('embedFont', [])).toBeUndefined();
  });

  it('picks the nearest of several near candidates', () => {
    // 'colr' -> 'color' (distance 1) beats 'colour' (distance 2).
    expect(didYouMean('colr', ['colour', 'color', 'collar'])).toBe('color');
  });

  it('respects the hard maxDistance bound', () => {
    // With a longer input the scaled threshold would allow 3, but capping at 1
    // rejects a distance-2 candidate.
    expect(didYouMean('addPageXY', ['addPagez'], 1)).toBeUndefined();
  });

  it('keeps short tokens strict via length scaling', () => {
    // Input length 3 => threshold 1; distance from 'abc' to 'axyz' exceeds 1.
    expect(didYouMean('abc', ['axyz'])).toBeUndefined();
  });
});
