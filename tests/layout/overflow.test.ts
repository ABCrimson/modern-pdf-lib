/**
 * Tests for text overflow handling utilities.
 *
 * Covers all five overflow modes (visible, wrap, truncate, ellipsis, shrink),
 * individual helper functions, edge cases, and the applyOverflow dispatcher.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTextWidth,
  wrapText,
  truncateText,
  ellipsisText,
  shrinkFontSize,
  applyOverflow,
} from '../../src/layout/overflow.js';
import { renderTable } from '../../src/layout/table.js';
import type { DrawTableOptions, TableCell } from '../../src/layout/table.js';

// ---------------------------------------------------------------------------
// estimateTextWidth
// ---------------------------------------------------------------------------

describe('estimateTextWidth', () => {
  // 1
  it('returns correct width with default avgCharWidth', () => {
    // 5 chars * 12pt * 0.5 = 30
    expect(estimateTextWidth('Hello', 12)).toBe(30);
  });

  // 2
  it('returns correct width with custom avgCharWidth', () => {
    // 4 chars * 10pt * 0.6 = 24
    expect(estimateTextWidth('Test', 10, 0.6)).toBe(24);
  });

  // 3
  it('returns 0 for empty string', () => {
    expect(estimateTextWidth('', 12)).toBe(0);
  });

  // 4
  it('returns correct width for single character', () => {
    // 1 char * 14pt * 0.5 = 7
    expect(estimateTextWidth('A', 14)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// wrapText
// ---------------------------------------------------------------------------

describe('wrapText', () => {
  // 5
  it('returns single line when text fits', () => {
    // 'Hi' = 2 chars, need 2*12*0.5 = 12pt; available = 100
    const lines = wrapText('Hi', 100, 12);
    expect(lines).toEqual(['Hi']);
  });

  // 6
  it('splits at word boundaries', () => {
    // availableWidth = 30pt, fontSize = 12, avgCharWidth = 0.5
    // charWidth = 6, maxChars = 5
    // 'Hello World' -> 'Hello' (5 chars), 'World' (5 chars)
    const lines = wrapText('Hello World', 30, 12);
    expect(lines).toEqual(['Hello', 'World']);
  });

  // 7
  it('breaks long words mid-word when they exceed line width', () => {
    // maxChars = floor(30 / (12 * 0.5)) = 5
    // 'Abcdefghij' = 10 chars, must split at 5
    const lines = wrapText('Abcdefghij', 30, 12);
    expect(lines.length).toBeGreaterThan(1);
    // Each line should be at most 5 chars
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(5);
    }
    // Joined text should reconstruct original
    expect(lines.join('')).toBe('Abcdefghij');
  });

  // 8
  it('returns empty string line for empty input', () => {
    const lines = wrapText('', 100, 12);
    expect(lines).toEqual(['']);
  });

  // 9
  it('handles multiple words across several lines', () => {
    // maxChars = floor(60 / (12 * 0.5)) = 10
    // 'The quick brown fox jumps' should wrap across lines
    const lines = wrapText('The quick brown fox jumps', 60, 12);
    expect(lines.length).toBeGreaterThan(1);
    // All content should be preserved
    expect(lines.join(' ')).toBe('The quick brown fox jumps');
  });
});

// ---------------------------------------------------------------------------
// truncateText
// ---------------------------------------------------------------------------

describe('truncateText', () => {
  // 10
  it('returns full text when it fits', () => {
    // 'Hi' = 2 chars, need 12pt; available = 100
    expect(truncateText('Hi', 100, 12)).toBe('Hi');
  });

  // 11
  it('cuts text to fit available width', () => {
    // maxChars = floor(30 / (12 * 0.5)) = 5
    expect(truncateText('Hello World', 30, 12)).toBe('Hello');
  });

  // 12
  it('returns empty string when availableWidth is 0', () => {
    expect(truncateText('Hello', 0, 12)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// ellipsisText
// ---------------------------------------------------------------------------

describe('ellipsisText', () => {
  // 13
  it('returns full text when it fits', () => {
    expect(ellipsisText('Hi', 100, 12)).toBe('Hi');
  });

  // 14
  it('adds "..." when text does not fit', () => {
    // maxChars = floor(30 / (12 * 0.5)) = 5
    // reservedChars = 3 ('...'), textChars = 2
    const result = ellipsisText('Hello World', 30, 12);
    expect(result).toBe('He...');
    expect(result.length).toBeLessThanOrEqual(5);
  });

  // 15
  it('uses custom ellipsis character', () => {
    // maxChars = 5, ellipsis '~' = 1 char, textChars = 4
    const result = ellipsisText('Hello World', 30, 12, { ellipsisChar: '~' });
    expect(result).toBe('Hell~');
  });
});

// ---------------------------------------------------------------------------
// shrinkFontSize
// ---------------------------------------------------------------------------

describe('shrinkFontSize', () => {
  // 16
  it('returns original size when text fits', () => {
    // 'Hi' needs 2 * 12 * 0.5 = 12pt; available = 100
    expect(shrinkFontSize('Hi', 100, 12)).toBe(12);
  });

  // 17
  it('returns smaller size for long text', () => {
    // 'Hello World' = 11 chars, needs 11*12*0.5 = 66pt; available = 33
    // shrunk = 33 / (11 * 0.5) = 6
    const result = shrinkFontSize('Hello World', 33, 12);
    expect(result).toBeLessThan(12);
    expect(result).toBe(6);
  });

  // 18
  it('clamps to minFontSize', () => {
    // Very long text that would require tiny font
    // 50 chars, available = 10, fontSize = 12
    // shrunk = 10 / (50 * 0.5) = 0.4 -> clamped to 6
    const result = shrinkFontSize('A'.repeat(50), 10, 12);
    expect(result).toBe(6);
  });

  // 19
  it('respects custom minFontSize', () => {
    const result = shrinkFontSize('A'.repeat(50), 10, 12, { minFontSize: 4 });
    expect(result).toBe(4);
  });

  // 20
  it('returns original size for empty string', () => {
    expect(shrinkFontSize('', 10, 12)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// applyOverflow
// ---------------------------------------------------------------------------

describe('applyOverflow', () => {
  // 21
  it('visible mode returns unchanged text', () => {
    const result = applyOverflow('Hello World', 'visible', 30, 12);
    expect(result.lines).toEqual(['Hello World']);
    expect(result.fontSize).toBe(12);
    expect(result.wasModified).toBe(false);
  });

  // 22
  it('wrap mode returns multiple lines', () => {
    const result = applyOverflow('Hello World', 'wrap', 30, 12);
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.fontSize).toBe(12);
    expect(result.wasModified).toBe(true);
  });

  // 23
  it('truncate mode truncates text', () => {
    const result = applyOverflow('Hello World', 'truncate', 30, 12);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]!.length).toBeLessThan('Hello World'.length);
    expect(result.fontSize).toBe(12);
    expect(result.wasModified).toBe(true);
  });

  // 24
  it('ellipsis mode adds ellipsis', () => {
    const result = applyOverflow('Hello World', 'ellipsis', 30, 12);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]!).toContain('...');
    expect(result.fontSize).toBe(12);
    expect(result.wasModified).toBe(true);
  });

  // 25
  it('shrink mode adjusts fontSize', () => {
    const result = applyOverflow('Hello World', 'shrink', 33, 12);
    expect(result.lines).toEqual(['Hello World']);
    expect(result.fontSize).toBeLessThan(12);
    expect(result.wasModified).toBe(true);
  });

  // 26
  it('wasModified is false when text already fits (non-visible modes)', () => {
    const modes = ['wrap', 'truncate', 'ellipsis', 'shrink'] as const;
    for (const mode of modes) {
      const result = applyOverflow('Hi', mode, 100, 12);
      expect(result.wasModified).toBe(false);
      expect(result.lines).toEqual(['Hi']);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  // 27
  it('handles empty string in all modes', () => {
    const modes = ['visible', 'wrap', 'truncate', 'ellipsis', 'shrink'] as const;
    for (const mode of modes) {
      const result = applyOverflow('', mode, 100, 12);
      expect(result.lines).toEqual(['']);
      expect(result.fontSize).toBe(12);
    }
  });

  // 28
  it('handles single character', () => {
    // 'A' needs 1 * 12 * 0.5 = 6pt; available = 6 -> exact fit
    const result = applyOverflow('A', 'truncate', 6, 12);
    expect(result.lines).toEqual(['A']);
    expect(result.wasModified).toBe(false);
  });

  // 29
  it('handles exact fit — text width equals available width', () => {
    // 'Hello' = 5 chars, needs 5*10*0.5 = 25pt; available = 25
    const result = applyOverflow('Hello', 'truncate', 25, 10);
    expect(result.lines).toEqual(['Hello']);
    expect(result.wasModified).toBe(false);
  });

  // 30
  it('ellipsis with very narrow width produces just ellipsis', () => {
    // maxChars = floor(18 / (12 * 0.5)) = 3
    // reservedChars = 3, textChars = 0
    const result = ellipsisText('Hello World', 18, 12);
    expect(result).toBe('...');
  });
});

// ---------------------------------------------------------------------------
// Table-integrated overflow tests
// ---------------------------------------------------------------------------

function makeTableOpts(overrides?: Partial<DrawTableOptions>): DrawTableOptions {
  return {
    x: 50,
    y: 700,
    width: 200,
    rows: [{ cells: ['Short'] }],
    ...overrides,
  };
}

describe('table overflow integration', () => {
  // 31
  it('truncate mode sets a clipping rectangle (W n operators)', () => {
    const cell: TableCell = {
      content: 'This is a very long text that exceeds the cell',
      overflow: 'truncate',
    };
    const { ops } = renderTable(
      makeTableOpts({ rows: [{ cells: [cell] }] }),
    );
    // truncate mode emits W (clip) and n (endPath)
    expect(ops).toContain('W\n');
    expect(ops).toContain('n\n');
  });

  // 32
  it('ellipsis mode adds "..." to truncated text', () => {
    const cell: TableCell = {
      content: 'This is a very long text that should be truncated with ellipsis',
      overflow: 'ellipsis',
    };
    const { ops } = renderTable(
      makeTableOpts({
        rows: [{ cells: [cell] }],
        columns: [{ width: 60 }],
      }),
    );
    expect(ops).toContain('...');
  });

  // 33
  it('wrap mode splits text into multiple lines and increases row height', () => {
    const cell: TableCell = {
      content: 'The quick brown fox jumps over the lazy dog and keeps running',
      overflow: 'wrap',
    };
    const { result: wrapResult } = renderTable(
      makeTableOpts({
        rows: [{ cells: [cell] }],
        columns: [{ width: 80 }],
      }),
    );
    const { result: noWrapResult } = renderTable(
      makeTableOpts({
        rows: [{ cells: ['The quick brown fox jumps over the lazy dog and keeps running'] }],
        columns: [{ width: 80 }],
      }),
    );
    // Wrapped row should be taller
    expect(wrapResult.rowHeights[0]!).toBeGreaterThan(noWrapResult.rowHeights[0]!);
  });

  // 34
  it('wrap mode renders multiple BT/ET pairs for each line', () => {
    const cell: TableCell = {
      content: 'Hello World Foo Bar Baz',
      overflow: 'wrap',
    };
    const { ops } = renderTable(
      makeTableOpts({
        rows: [{ cells: [cell] }],
        columns: [{ width: 40 }],
        fontSize: 10,
      }),
    );
    // Should have multiple BT/ET pairs (one per line)
    const btCount = (ops.match(/BT\n/g) || []).length;
    expect(btCount).toBeGreaterThan(1);
  });

  // 35
  it('shrink mode reduces font size for long text', () => {
    const cell: TableCell = {
      content: 'A very long text that needs shrinking to fit in the cell width',
      overflow: 'shrink',
    };
    const { ops } = renderTable(
      makeTableOpts({
        rows: [{ cells: [cell] }],
        columns: [{ width: 80 }],
        fontSize: 12,
      }),
    );
    // Should have a Tf operator with a size smaller than 12
    const tfMatch = ops.match(/\/Helvetica (\S+) Tf/);
    expect(tfMatch).not.toBeNull();
    const renderedSize = parseFloat(tfMatch![1]!);
    expect(renderedSize).toBeLessThan(12);
  });

  // 36
  it('short text is unaffected by any overflow mode', () => {
    const modes = ['truncate', 'ellipsis', 'wrap', 'shrink'] as const;
    for (const mode of modes) {
      const cell: TableCell = { content: 'Hi', overflow: mode };
      const { ops } = renderTable(
        makeTableOpts({ rows: [{ cells: [cell] }] }),
      );
      expect(ops).toContain('(Hi) Tj');
    }
  });

  // 37
  it('default overflow mode is truncate', () => {
    // Cell with long text but no explicit overflow should use truncate (clip)
    const cell: TableCell = {
      content: 'This is a very long text that exceeds the cell width',
    };
    const { ops } = renderTable(
      makeTableOpts({ rows: [{ cells: [cell] }] }),
    );
    // Default truncate mode emits clip operators
    expect(ops).toContain('W\n');
    expect(ops).toContain('n\n');
  });
});
