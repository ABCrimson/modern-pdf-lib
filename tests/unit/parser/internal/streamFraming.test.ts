import { describe, expect, it } from 'vitest';
import { KeywordIndex, frameStreamData } from '../../../../src/parser/internal/streamFraming.js';
import { latin1 } from '../../../helpers/stream-length-fixtures.js';

const text = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

/** Frames the stream that starts after the first "stream\n" of `source`. */
function frame(source: string, declared: number | undefined) {
  const bytes = latin1(source);
  const start = source.indexOf('stream\n') + 'stream\n'.length;
  const result = frameStreamData(bytes, start, declared, new KeywordIndex(bytes));
  return result === undefined
    ? undefined
    : {
        ...result,
        data: text(bytes.subarray(result.start, result.end)),
        rest: source.slice(result.resumeAt),
      };
}

describe('frameStreamData: trusted length', () => {
  it('takes the declared bytes when endstream follows', () => {
    const r = frame('stream\nabcde\nendstream\nendobj', 5);
    expect(r).toMatchObject({ data: 'abcde', recovered: false, rest: '\nendobj' });
  });

  it('skips PDF whitespace, including NUL and FF, before endstream', () => {
    expect(frame('stream\nabc \0\f\r\n\tendstream', 3)).toMatchObject({
      data: 'abc',
      recovered: false,
    });
  });

  it('accepts endstream at the end of the input and before a delimiter', () => {
    expect(frame('stream\nabcendstream', 3)?.recovered).toBe(false);
    expect(frame('stream\nabcendstream>>', 3)?.recovered).toBe(false);
  });

  it('keeps an EOL that the length counts', () => {
    expect(frame('stream\nabc\r\nendstream', 5)).toMatchObject({
      data: 'abc\r\n',
      recovered: false,
    });
  });

  it('accepts a zero length when endstream follows at once', () => {
    expect(frame('stream\n\nendstream', 0)).toMatchObject({ data: '', recovered: false });
  });
});

describe('frameStreamData: recovery', () => {
  it('ends at the first endstream and trims one LF', () => {
    expect(frame('stream\nabcde\nendstream\nendobj', 2)).toMatchObject({
      data: 'abcde',
      recovered: true,
      rest: '\nendobj',
    });
  });

  it('trims CRLF, a lone CR and a lone LF as one EOL each', () => {
    expect(frame('stream\nabc\r\nendstream', undefined)?.data).toBe('abc');
    expect(frame('stream\nabc\rendstream', undefined)?.data).toBe('abc');
    expect(frame('stream\nabc\nendstream', undefined)?.data).toBe('abc');
  });

  it('trims at most one EOL', () => {
    expect(frame('stream\nabc\n\n\nendstream', undefined)?.data).toBe('abc\n\n');
    expect(frame('stream\nabc  endstream', undefined)?.data).toBe('abc  ');
  });

  it('does not trim below the data start', () => {
    expect(frame('stream\n\nendstream', undefined)).toMatchObject({ data: '', recovered: true });
  });

  it.each([undefined, 0, 3, 5000])('recovers from the declared length %s that misses', (len) => {
    expect(frame('stream\nabcdef\nendstream', len)).toMatchObject({
      data: 'abcdef',
      recovered: true,
    });
  });

  it('does not match endstream followed by a regular character', () => {
    expect(frame('stream\nabc\nendstreamX more\nendstream', undefined)?.data).toBe(
      'abc\nendstreamX more',
    );
  });

  it('falls back to endobj when no endstream follows', () => {
    expect(frame('stream\nabc\nendobj\n', undefined)).toMatchObject({
      data: 'abc',
      recovered: true,
      rest: 'endobj\n',
    });
  });

  it('uses endobj when it comes before endstream', () => {
    expect(frame('stream\nabc\nendobj\n5 0 obj\nendstream', undefined)?.data).toBe('abc');
  });

  it('cuts at an endstream inside the data and resumes at the next endobj', () => {
    expect(frame('stream\nabc %endstream\nmore\nendstream\nendobj', 4)).toMatchObject({
      data: 'abc %',
      rest: 'endobj',
    });
  });

  it('resumes after endstream when only white space separates it from endobj', () => {
    expect(frame('stream\nabc %endstream\n \nendobj', 4)?.rest).toBe('\n \nendobj');
  });

  it('returns undefined when neither keyword follows', () => {
    expect(frame('stream\nabc', undefined)).toBeUndefined();
    expect(frame('stream\nabc', 99)).toBeUndefined();
  });

  it('treats a length beyond the input as undeclared', () => {
    expect(frame('stream\nabc\nendstream', 1e12)).toMatchObject({ data: 'abc', recovered: true });
  });
});

describe('frameStreamData: what may lie between the declared data and endstream', () => {
  it('skips a comment, a comment ended by CR, and white space around comments', () => {
    expect(frame('stream\nabc\n% a comment\nendstream', 3)).toMatchObject({
      data: 'abc',
      recovered: false,
    });
    expect(frame('stream\nabc\r% one\r\t% two\n endstream', 3)).toMatchObject({
      data: 'abc',
      recovered: false,
    });
  });

  it('does not take a comment that runs to the end of the input for white space', () => {
    expect(frame('stream\nabc\n% no end', 3)).toBeUndefined();
    expect(frame('stream\nabc% endstream\nendobj', 3)).toMatchObject({ recovered: true });
  });

  it('skips more than 4096 white-space bytes while the input allows it', () => {
    expect(frame(`stream\nabc${' '.repeat(5000)}endstream`, 3)).toMatchObject({
      data: 'abc',
      recovered: false,
    });
    expect(frame(`stream\nabc${'\n'.repeat(5000)}endstream`, 3)).toMatchObject({
      data: 'abc',
      recovered: false,
    });
  });

  it('refuses a gap that outruns the allowance of the input, and then recovers', () => {
    const bytes = latin1(`stream\nabc${' '.repeat(5000)}endstream`);
    const index = new KeywordIndex(bytes);
    // 5000 bytes: 4096 are free, 904 are paid from the allowance.
    index.trailingSkipBudget = 903;
    expect(frameStreamData(bytes, 7, 3, index)).toMatchObject({ recovered: true });
    index.trailingSkipBudget = 904;
    expect(frameStreamData(bytes, 7, 3, index)).toMatchObject({ recovered: false });
    expect(index.trailingSkipBudget).toBe(0);
  });

  it('starts the allowance at the length of the input, whether or not it was scanned', () => {
    const bytes = latin1('stream\nabc\nendstream');
    const index = new KeywordIndex(bytes);
    expect(index.trailingSkipBudget).toBe(bytes.length);
    index.nextEndstream(0);
    expect(index.trailingSkipBudget).toBe(bytes.length);
  });

  it('keeps the cost of many long gaps linear in the input', () => {
    // 50 streams with a 6000-byte gap each: 1904 bytes of every gap come from the allowance.
    const gap = ' '.repeat(6000);
    let source = '';
    const starts: number[] = [];
    for (let i = 0; i < 50; i++) {
      source += 'stream\n';
      starts.push(source.length);
      source += `x${gap}endstream\n`;
    }
    const bytes = latin1(source);
    const index = new KeywordIndex(bytes);
    let skipped = 0;
    for (const start of starts) {
      const result = frameStreamData(bytes, start, 1, index);
      if (result?.recovered === false) skipped++;
    }
    // The allowance is the input's length (about 300 KB), enough for these 50 gaps (95 KB).
    expect(skipped).toBe(50);
    expect(index.trailingSkipBudget).toBeGreaterThanOrEqual(0);
    expect(index.trailingSkipBudget).toBeLessThan(bytes.length);
  });
});

describe('frameStreamData: a gap is paid for once', () => {
  it('frames the same stream again to the same end, with one index', () => {
    const bytes = latin1(`stream\nabc${' '.repeat(20_000)}endstream`);
    const index = new KeywordIndex(bytes);
    for (let i = 0; i < 3; i++) {
      expect(frameStreamData(bytes, 7, 3, index)).toMatchObject({ recovered: false, end: 10 });
    }
  });
});

describe('KeywordIndex', () => {
  it('is built on the first recovery only, and once', () => {
    const bytes = latin1('stream\nabc\nendstream\nstream\nxyz\nendstream');
    const index = new KeywordIndex(bytes);
    expect(index.builds).toBe(0);
    // Trusted framing needs no index.
    expect(frameStreamData(bytes, 7, 3, index)?.recovered).toBe(false);
    expect(index.builds).toBe(0);
    frameStreamData(bytes, 7, 1, index);
    frameStreamData(bytes, 28, 1, index);
    frameStreamData(bytes, 7, undefined, index);
    expect(index.builds).toBe(1);
  });

  it('finds the first keyword at or after the start by binary search', () => {
    const bytes = latin1('endstream endstream endstream');
    const index = new KeywordIndex(bytes);
    expect(index.nextEndstream(0)).toBe(0);
    expect(index.nextEndstream(1)).toBe(10);
    expect(index.nextEndstream(11)).toBe(20);
    expect(index.nextEndstream(21)).toBe(-1);
    expect(index.nextEndobj(0)).toBe(-1);
  });
});
