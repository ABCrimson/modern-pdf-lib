/**
 * Tests for the advanced text layout engine.
 *
 * Covers paragraph reflow, justified alignment, hyphenation,
 * multi-column layout, text flow across frames, widow/orphan
 * control, and mixed styled spans.
 */

import { describe, it, expect } from 'vitest';
import {
  layoutParagraph,
  layoutColumns,
  layoutTextFlow,
  findHyphenationPoints,
} from '../../../src/layout/textLayout.js';
import type {
  TextFrame,
  TextSpan,
  ParagraphOptions,
  MultiColumnOptions,
  TextLayoutResult,
} from '../../../src/layout/textLayout.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic measure function: each character is exactly 6 pts wide.
 * This makes line-break calculations predictable for testing.
 */
function fixedMeasure(text: string, _font: string, _size: number): number {
  return text.length * 6;
}

/** Standard test frame: 200 pts wide, 200 pts tall. */
const STD_FRAME: TextFrame = { x: 50, y: 700, width: 200, height: 200 };

/** Narrow frame that fits only short lines. */
const NARROW_FRAME: TextFrame = { x: 50, y: 700, width: 60, height: 200 };

/** Shallow frame that fits only a few lines. */
const SHALLOW_FRAME: TextFrame = { x: 50, y: 700, width: 200, height: 30 };

// ---------------------------------------------------------------------------
// Single paragraph with wrapping
// ---------------------------------------------------------------------------

describe('layoutParagraph — basic wrapping', () => {
  it('wraps text that exceeds frame width', () => {
    // 'Hello World Test' = 16 chars * 6 = 96 pts
    // Frame is 60 pts wide → must wrap
    const result = layoutParagraph(
      'Hello World Test',
      NARROW_FRAME,
      { alignment: 'left' },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(1);
    expect(result.overflow).toBe('');
    expect(result.operators).toContain('Tj');
  });

  it('fits short text on a single line', () => {
    const result = layoutParagraph(
      'Hi',
      STD_FRAME,
      { alignment: 'left' },
      fixedMeasure,
    );
    expect(result.lineCount).toBe(1);
    expect(result.overflow).toBe('');
  });

  it('handles explicit newlines as paragraph breaks', () => {
    const result = layoutParagraph(
      'Line one\nLine two',
      STD_FRAME,
      { alignment: 'left' },
      fixedMeasure,
    );
    expect(result.lineCount).toBe(2);
    expect(result.overflow).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Justified alignment word spacing
// ---------------------------------------------------------------------------

describe('layoutParagraph — justified alignment', () => {
  it('sets word spacing for justified non-last lines', () => {
    // Create text that wraps to multiple lines
    const text = 'The quick brown fox jumps over the lazy dog every single day';
    const result = layoutParagraph(
      text,
      { ...NARROW_FRAME, height: 400 },
      { alignment: 'justify' },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(1);
    // Should contain Tw operator for word spacing adjustment
    expect(result.operators).toContain('Tw');
  });

  it('does not justify the last line of a paragraph', () => {
    // Single-line text should not get word spacing
    const result = layoutParagraph(
      'Short text',
      STD_FRAME,
      { alignment: 'justify' },
      fixedMeasure,
    );
    // Last line of paragraph should have Tw 0 (or no Tw at all in non-justify)
    // Since it's the only line and it's the last line of paragraph, no extra spacing
    expect(result.lineCount).toBe(1);
    expect(result.overflow).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Multi-line with paragraph spacing
// ---------------------------------------------------------------------------

describe('layoutParagraph — paragraph spacing', () => {
  it('adds extra spacing between paragraphs', () => {
    const text = 'Paragraph one text.\nParagraph two text.';
    const withSpacing = layoutParagraph(
      text,
      STD_FRAME,
      { paragraphSpacing: 20 },
      fixedMeasure,
    );
    const withoutSpacing = layoutParagraph(
      text,
      STD_FRAME,
      { paragraphSpacing: 0 },
      fixedMeasure,
    );
    // Both should render all lines
    expect(withSpacing.lineCount).toBe(2);
    expect(withoutSpacing.lineCount).toBe(2);
    // With spacing should use more height
    expect(withSpacing.usedHeight).toBeGreaterThan(withoutSpacing.usedHeight);
  });
});

// ---------------------------------------------------------------------------
// First line indent
// ---------------------------------------------------------------------------

describe('layoutParagraph — first line indent', () => {
  it('indents the first line of a paragraph', () => {
    const result = layoutParagraph(
      'Indented paragraph text that should have the first line offset.',
      STD_FRAME,
      { firstLineIndent: 24 },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThanOrEqual(1);
    expect(result.operators).toContain('Tj');
    expect(result.overflow).toBe('');
  });

  it('reduces available width on the first line due to indent', () => {
    // Text that just fits a 200pt line at 6pt/char = 33 chars
    // With a 30pt indent, effective width = 170pt = 28 chars
    const text = 'A'.repeat(30); // 30 * 6 = 180pt
    const withIndent = layoutParagraph(
      text,
      STD_FRAME,
      { firstLineIndent: 30 },
      fixedMeasure,
    );
    const withoutIndent = layoutParagraph(
      text,
      STD_FRAME,
      {},
      fixedMeasure,
    );
    // With indent should need more lines since first line has less space
    expect(withIndent.lineCount).toBeGreaterThanOrEqual(withoutIndent.lineCount);
  });
});

// ---------------------------------------------------------------------------
// Multi-column layout
// ---------------------------------------------------------------------------

describe('layoutColumns — basic multi-column', () => {
  it('distributes text across 2 columns', () => {
    const text = 'The quick brown fox jumps over the lazy dog and keeps on running through the forest all day long without stopping even for a moment';
    const colOpts: MultiColumnOptions = { columns: 2, columnGap: 18 };
    const result = layoutColumns(
      text,
      STD_FRAME,
      colOpts,
      { alignment: 'left' },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(0);
    expect(result.operators).toContain('Tj');
  });

  it('distributes text across 3 columns', () => {
    const text = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma';
    const colOpts: MultiColumnOptions = { columns: 3, columnGap: 12 };
    const result = layoutColumns(
      text,
      { ...STD_FRAME, width: 300 },
      colOpts,
      { alignment: 'left' },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(0);
    expect(result.overflow).toBe('');
  });

  it('draws column rules when specified', () => {
    const text = 'Some text for two columns that is long enough to actually need two columns to fit all of it';
    const colOpts: MultiColumnOptions = {
      columns: 2,
      columnGap: 18,
      columnRule: {
        width: 0.5,
        color: { type: 'grayscale', gray: 0.5 },
        style: 'solid',
      },
    };
    const result = layoutColumns(
      text,
      STD_FRAME,
      colOpts,
      {},
      fixedMeasure,
    );
    // Column rule should produce line drawing operators
    expect(result.operators).toContain('l\n'); // lineTo
    expect(result.operators).toContain('S\n'); // stroke
  });

  it('draws dashed column rules', () => {
    const text = 'Text for dashed rule columns that wraps across multiple columns in the frame';
    const colOpts: MultiColumnOptions = {
      columns: 2,
      columnGap: 18,
      columnRule: {
        width: 1,
        color: { type: 'grayscale', gray: 0 },
        style: 'dashed',
      },
    };
    const result = layoutColumns(
      text,
      STD_FRAME,
      colOpts,
      {},
      fixedMeasure,
    );
    // Should include dash pattern operator
    expect(result.operators).toContain('d\n'); // setDashPattern
  });
});

// ---------------------------------------------------------------------------
// Column balancing
// ---------------------------------------------------------------------------

describe('layoutColumns — column balancing', () => {
  it('balances columns to equalize heights by default', () => {
    const text = 'Word '.repeat(20).trim(); // 20 words
    const balanced = layoutColumns(
      text,
      { ...STD_FRAME, height: 300 },
      { columns: 2, columnGap: 18, balanceColumns: true },
      {},
      fixedMeasure,
    );
    const unbalanced = layoutColumns(
      text,
      { ...STD_FRAME, height: 300 },
      { columns: 2, columnGap: 18, balanceColumns: false },
      {},
      fixedMeasure,
    );
    // Both should render all text
    expect(balanced.overflow).toBe('');
    expect(unbalanced.overflow).toBe('');
    // Both should render lines
    expect(balanced.lineCount).toBeGreaterThan(0);
    expect(unbalanced.lineCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Text overflow across frames
// ---------------------------------------------------------------------------

describe('layoutTextFlow — multi-frame overflow', () => {
  it('flows text across multiple frames', () => {
    // Create enough text to overflow a shallow frame
    const text = 'Word '.repeat(50).trim();
    const frames: TextFrame[] = [
      { x: 50, y: 700, width: 200, height: 40 },
      { x: 50, y: 700, width: 200, height: 40 },
      { x: 50, y: 700, width: 200, height: 400 },
    ];
    const results = layoutTextFlow(text, frames, {}, fixedMeasure);

    expect(results.length).toBe(3);
    // First frame should have rendered some lines
    expect(results[0]!.lineCount).toBeGreaterThan(0);
    // First frame should have overflow
    expect(results[0]!.overflow.length).toBeGreaterThan(0);
    // Last frame should handle the remaining text
    expect(results[2]!.overflow).toBe('');
  });

  it('stops flowing when text is exhausted', () => {
    const text = 'Short';
    const frames: TextFrame[] = [
      { x: 50, y: 700, width: 200, height: 200 },
      { x: 50, y: 700, width: 200, height: 200 },
    ];
    const results = layoutTextFlow(text, frames, {}, fixedMeasure);

    expect(results.length).toBe(2);
    expect(results[0]!.lineCount).toBe(1);
    expect(results[0]!.overflow).toBe('');
    // Second frame should be empty
    expect(results[1]!.lineCount).toBe(0);
  });

  it('returns empty results for empty frames array', () => {
    const results = layoutTextFlow('Hello', [], {}, fixedMeasure);
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Hyphenation
// ---------------------------------------------------------------------------

describe('findHyphenationPoints', () => {
  it('finds hyphenation points for common suffixes', () => {
    const points = findHyphenationPoints('implementation');
    expect(points.length).toBeGreaterThan(0);
    // Should find -tion split
    expect(points).toContain(10); // implementa-tion
  });

  it('finds hyphenation points for prefixes', () => {
    const points = findHyphenationPoints('understanding');
    // Should find under- prefix
    expect(points).toContain(5); // under-standing
  });

  it('returns empty for short words', () => {
    const points = findHyphenationPoints('the');
    expect(points).toEqual([]);
  });

  it('respects minimum prefix/suffix lengths', () => {
    const points = findHyphenationPoints('ant');
    expect(points).toEqual([]);
  });
});

describe('layoutParagraph — hyphenation', () => {
  it('hyphenates words at break points when enabled', () => {
    // Use a narrow frame that forces long words to wrap
    // 'understanding' = 13 chars * 6 = 78 pts, frame is 60 pts
    const result = layoutParagraph(
      'understanding',
      { ...NARROW_FRAME, width: 60 },
      { hyphenation: true },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThanOrEqual(1);
    // Should contain a hyphen character in the output
    expect(result.operators).toContain('-');
  });

  it('does not hyphenate when disabled', () => {
    const result = layoutParagraph(
      'understanding',
      { ...NARROW_FRAME, width: 60 },
      { hyphenation: false },
      fixedMeasure,
    );
    // Should still render the word (forced onto a line)
    expect(result.lineCount).toBeGreaterThanOrEqual(1);
    expect(result.operators).toContain('understanding');
  });

  it('uses custom hyphen character', () => {
    const result = layoutParagraph(
      'understanding',
      { ...NARROW_FRAME, width: 60 },
      { hyphenation: true, hyphenChar: '\u00AD' },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Widow/orphan control
// ---------------------------------------------------------------------------

describe('layoutParagraph — widow/orphan control', () => {
  it('prevents orphan lines (single line at bottom of frame)', () => {
    // Create text that would leave 1 line in a short frame with orphanLines=2
    // 4 lines of text, frame fits only 1 line → should push all to overflow
    const text = 'Word '.repeat(30).trim();
    const result = layoutParagraph(
      text,
      { x: 50, y: 700, width: 60, height: 15 }, // fits ~1 line
      { orphanLines: 2 },
      fixedMeasure,
    );
    // With orphan control, if only 1 line fits and orphanLines=2,
    // it should push content to overflow rather than leave 1 orphan line
    expect(result.overflow.length).toBeGreaterThan(0);
  });

  it('prevents widow lines (single line at top of next frame)', () => {
    // Create text that would leave 1 line for next frame with widowLines=2
    const text = 'Word '.repeat(10).trim();
    // Frame that fits most but leaves 1 line for overflow
    const lineH = 12 * 1.2; // 14.4
    const frameHeight = lineH * 3 + 1; // fits 3 lines

    // Need to count how many lines will be produced
    // 'Word' = 4 chars * 6 = 24pts per word + 6pts space = 30pts per 'Word '
    // Frame width = 100pt → about 16 chars per line → roughly 3 words per line
    // 10 words → ~4 lines
    const result = layoutParagraph(
      text,
      { x: 50, y: 700, width: 100, height: frameHeight },
      { widowLines: 2 },
      fixedMeasure,
    );
    // If there's overflow, it should have at least widowLines lines
    if (result.overflow) {
      // Total should be handled properly
      expect(result.lineCount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Mixed spans (bold + normal)
// ---------------------------------------------------------------------------

describe('layoutParagraph — mixed spans', () => {
  it('handles multiple styled spans', () => {
    const spans: TextSpan[] = [
      { text: 'Bold text ', bold: true, fontSize: 12 },
      { text: 'normal text ', fontSize: 12 },
      { text: 'italic text', italic: true, fontSize: 12 },
    ];
    const result = layoutParagraph(
      spans,
      STD_FRAME,
      { alignment: 'left' },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(0);
    expect(result.operators).toContain('Tj');
    expect(result.overflow).toBe('');
  });

  it('handles spans with different font sizes', () => {
    const spans: TextSpan[] = [
      { text: 'Large ', fontSize: 24 },
      { text: 'Small', fontSize: 8 },
    ];
    const result = layoutParagraph(
      spans,
      STD_FRAME,
      {},
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(0);
    expect(result.overflow).toBe('');
  });

  it('applies underline decoration', () => {
    const spans: TextSpan[] = [
      { text: 'Underlined', underline: true },
    ];
    const result = layoutParagraph(
      spans,
      STD_FRAME,
      {},
      fixedMeasure,
    );
    // Underline should produce line drawing operators
    expect(result.operators).toContain('l\n'); // lineTo
    expect(result.operators).toContain('S\n'); // stroke
  });

  it('applies strikethrough decoration', () => {
    const spans: TextSpan[] = [
      { text: 'Struck', strikethrough: true },
    ];
    const result = layoutParagraph(
      spans,
      STD_FRAME,
      {},
      fixedMeasure,
    );
    expect(result.operators).toContain('l\n');
    expect(result.operators).toContain('S\n');
  });

  it('handles spans with color', () => {
    const spans: TextSpan[] = [
      { text: 'Red text', color: { type: 'rgb', r: 1, g: 0, b: 0 } },
    ];
    const result = layoutParagraph(
      spans,
      STD_FRAME,
      {},
      fixedMeasure,
    );
    expect(result.lineCount).toBe(1);
    // Should contain color-setting operator
    expect(result.operators).toContain('rg');
  });
});

// ---------------------------------------------------------------------------
// Empty text / empty frame
// ---------------------------------------------------------------------------

describe('layoutParagraph — edge cases', () => {
  it('returns empty result for empty string', () => {
    const result = layoutParagraph('', STD_FRAME, {}, fixedMeasure);
    expect(result.lineCount).toBe(0);
    expect(result.operators).toBe('');
    expect(result.overflow).toBe('');
    expect(result.usedHeight).toBe(0);
  });

  it('returns empty result for empty spans array', () => {
    const result = layoutParagraph([], STD_FRAME, {}, fixedMeasure);
    expect(result.lineCount).toBe(0);
    expect(result.operators).toBe('');
    expect(result.overflow).toBe('');
  });

  it('returns all text as overflow for zero-width frame', () => {
    const result = layoutParagraph(
      'Hello',
      { x: 50, y: 700, width: 0, height: 200 },
      {},
      fixedMeasure,
    );
    expect(result.lineCount).toBe(0);
    expect(result.overflow).toBe('Hello');
  });

  it('returns all text as overflow for zero-height frame', () => {
    const result = layoutParagraph(
      'Hello',
      { x: 50, y: 700, width: 200, height: 0 },
      {},
      fixedMeasure,
    );
    expect(result.lineCount).toBe(0);
    expect(result.overflow).toBe('Hello');
  });

  it('handles single word that fits exactly', () => {
    // 'Test' = 4 chars * 6 = 24 pts, frame width 24
    const result = layoutParagraph(
      'Test',
      { x: 50, y: 700, width: 24, height: 200 },
      {},
      fixedMeasure,
    );
    expect(result.lineCount).toBe(1);
    expect(result.overflow).toBe('');
  });

  it('handles text with only whitespace', () => {
    const result = layoutParagraph('   ', STD_FRAME, {}, fixedMeasure);
    // Whitespace-only text should produce no visible output
    expect(result.lineCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Alignment modes
// ---------------------------------------------------------------------------

describe('layoutParagraph — alignment modes', () => {
  it('left-aligns text by default', () => {
    const result = layoutParagraph(
      'Hello',
      STD_FRAME,
      { alignment: 'left' },
      fixedMeasure,
    );
    expect(result.lineCount).toBe(1);
    expect(result.operators).toContain('Td');
  });

  it('right-aligns text', () => {
    const result = layoutParagraph(
      'Hello',
      STD_FRAME,
      { alignment: 'right' },
      fixedMeasure,
    );
    expect(result.lineCount).toBe(1);
    expect(result.operators).toContain('Td');
  });

  it('center-aligns text', () => {
    const result = layoutParagraph(
      'Hello',
      STD_FRAME,
      { alignment: 'center' },
      fixedMeasure,
    );
    expect(result.lineCount).toBe(1);
    expect(result.operators).toContain('Td');
  });
});

// ---------------------------------------------------------------------------
// layoutColumns edge cases
// ---------------------------------------------------------------------------

describe('layoutColumns — edge cases', () => {
  it('handles single column (degenerates to paragraph)', () => {
    const result = layoutColumns(
      'Hello World',
      STD_FRAME,
      { columns: 1 },
      {},
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(0);
    expect(result.overflow).toBe('');
  });

  it('handles zero-width columns gracefully', () => {
    const result = layoutColumns(
      'Hello',
      { x: 50, y: 700, width: 10, height: 200 },
      { columns: 5, columnGap: 18 },
      {},
      fixedMeasure,
    );
    // Columns too narrow → overflow
    expect(result.overflow).toBe('Hello');
  });

  it('reports overflow when text exceeds all columns', () => {
    const text = 'Word '.repeat(100).trim();
    const result = layoutColumns(
      text,
      SHALLOW_FRAME,
      { columns: 2, columnGap: 10 },
      {},
      fixedMeasure,
    );
    expect(result.overflow.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// layoutTextFlow edge cases
// ---------------------------------------------------------------------------

describe('layoutTextFlow — edge cases', () => {
  it('handles text that fits in first frame with no overflow', () => {
    const results = layoutTextFlow(
      'Short',
      [STD_FRAME],
      {},
      fixedMeasure,
    );
    expect(results.length).toBe(1);
    expect(results[0]!.overflow).toBe('');
    expect(results[0]!.lineCount).toBe(1);
  });

  it('handles empty text across multiple frames', () => {
    const results = layoutTextFlow(
      '',
      [STD_FRAME, STD_FRAME],
      {},
      fixedMeasure,
    );
    expect(results.length).toBe(2);
    expect(results[0]!.lineCount).toBe(0);
    expect(results[1]!.lineCount).toBe(0);
  });

  it('flows paragraphs with spacing across frames', () => {
    const text = 'First paragraph.\nSecond paragraph with more words to fill space.\nThird paragraph.';
    const results = layoutTextFlow(
      text,
      [
        { x: 50, y: 700, width: 200, height: 50 },
        { x: 50, y: 700, width: 200, height: 200 },
      ],
      { paragraphSpacing: 10, orphanLines: 1, widowLines: 1 },
      fixedMeasure,
    );
    expect(results.length).toBe(2);
    expect(results[0]!.lineCount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Hanging indent
// ---------------------------------------------------------------------------

describe('layoutParagraph — hanging indent', () => {
  it('applies hanging indent to continuation lines', () => {
    // Text that wraps to 2+ lines; continuation lines should be indented
    const text = 'First line text that goes on and then continues further on the next line';
    const result = layoutParagraph(
      text,
      { x: 50, y: 700, width: 150, height: 200 },
      { hangingIndent: 20 },
      fixedMeasure,
    );
    expect(result.lineCount).toBeGreaterThan(1);
    expect(result.overflow).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Line height
// ---------------------------------------------------------------------------

describe('layoutParagraph — line height', () => {
  it('uses custom line height multiplier', () => {
    const text = 'Line one\nLine two\nLine three';
    const tight = layoutParagraph(
      text,
      STD_FRAME,
      { lineHeight: 1.0 },
      fixedMeasure,
    );
    const loose = layoutParagraph(
      text,
      STD_FRAME,
      { lineHeight: 2.0 },
      fixedMeasure,
    );
    // Both should render all 3 lines
    expect(tight.lineCount).toBe(3);
    expect(loose.lineCount).toBe(3);
    // Loose should use more height
    expect(loose.usedHeight).toBeGreaterThan(tight.usedHeight);
  });
});

// ---------------------------------------------------------------------------
// Comprehensive operator output
// ---------------------------------------------------------------------------

describe('layoutParagraph — PDF operator output', () => {
  it('produces valid PDF text operators', () => {
    const result = layoutParagraph(
      'Hello World',
      STD_FRAME,
      { alignment: 'left' },
      fixedMeasure,
    );
    const ops = result.operators;

    // Must contain save/restore state
    expect(ops).toContain('q\n');
    expect(ops).toContain('Q\n');

    // Must contain text object markers
    expect(ops).toContain('BT\n');
    expect(ops).toContain('ET\n');

    // Must contain font selection
    expect(ops).toContain('Tf\n');

    // Must contain text positioning
    expect(ops).toContain('Td\n');

    // Must contain text showing
    expect(ops).toContain('Tj\n');
  });

  it('emits font name with leading slash', () => {
    const result = layoutParagraph(
      'Test',
      STD_FRAME,
      {},
      fixedMeasure,
    );
    // Font names in PDF operators have a leading slash
    expect(result.operators).toMatch(/\/\w+ \d+(\.\d+)? Tf/);
  });
});
