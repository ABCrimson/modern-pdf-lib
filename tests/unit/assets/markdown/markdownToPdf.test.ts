import { describe, it, expect } from 'vitest';
import { markdownToPdf } from '../../../../src/assets/markdown/markdownToPdf.js';

/** Decode the first `n` bytes of a Uint8Array to a Latin-1 string. */
function header(bytes: Uint8Array, n = 5): string {
  return new TextDecoder('latin1').decode(bytes.subarray(0, n));
}

describe('markdownToPdf', () => {
  it('produces a non-empty PDF starting with the %PDF- header', async () => {
    const bytes = await markdownToPdf('# Title\n\nHello world\n\n- a\n- b');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    expect(header(bytes)).toBe('%PDF-');
  });

  it('renders an empty document without throwing', async () => {
    const bytes = await markdownToPdf('');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    expect(header(bytes)).toBe('%PDF-');
  });

  it('renders headings of every ATX level', async () => {
    const md = ['# h1', '## h2', '### h3', '#### h4', '##### h5', '###### h6'].join('\n\n');
    const bytes = await markdownToPdf(md);
    expect(header(bytes)).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('renders unordered list items with -, *, and +', async () => {
    const md = '- dash item\n* star item\n+ plus item';
    const bytes = await markdownToPdf(md);
    expect(header(bytes)).toBe('%PDF-');
  });

  it('renders fenced code blocks', async () => {
    const md = [
      'Intro paragraph.',
      '',
      '```',
      'const x = 1;',
      'function f() { return x; }',
      '```',
      '',
      'Outro paragraph.',
    ].join('\n');
    const bytes = await markdownToPdf(md);
    expect(header(bytes)).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('strips common inline emphasis markers without throwing', async () => {
    const bytes = await markdownToPdf('Some **bold** and `code` and __underline__ text.');
    expect(header(bytes)).toBe('%PDF-');
  });

  it('wraps very long lines and produces larger output for larger input', async () => {
    const short = await markdownToPdf('Hello world');
    const longParagraph = Array.from({ length: 40 }, (_, i) =>
      `Paragraph ${i} with several words that should wrap across the page width many times over and over.`,
    ).join('\n\n');
    const long = await markdownToPdf(longParagraph);

    expect(header(long)).toBe('%PDF-');
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('breaks a single over-long word at the character level', async () => {
    const longWord = 'a'.repeat(2000);
    const bytes = await markdownToPdf(longWord);
    expect(header(bytes)).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('paginates across multiple pages for tall documents', async () => {
    const manyLines = Array.from({ length: 300 }, (_, i) => `Line number ${i}`).join('\n\n');
    const bytes = await markdownToPdf(manyLines);
    expect(header(bytes)).toBe('%PDF-');
    // A 300-paragraph document must span more than a single A4 page.
    const text = new TextDecoder('latin1').decode(bytes);
    const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
  });

  it('honours custom fontSize, margin, and lineHeight options', async () => {
    const bytes = await markdownToPdf('# Custom\n\nbody text', {
      fontSize: 16,
      margin: 72,
      lineHeight: 1.6,
    });
    expect(header(bytes)).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('handles CRLF newlines', async () => {
    const bytes = await markdownToPdf('# Title\r\n\r\nA paragraph.\r\n\r\n- item');
    expect(header(bytes)).toBe('%PDF-');
  });
});
