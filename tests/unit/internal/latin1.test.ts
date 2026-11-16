/**
 * latin1Bytes: a PDF byte string (code units 0x00-0xFF) as one byte per code unit.
 */
import { describe, expect, test } from 'vitest';
import { UnencodableTextError } from '../../../src/errors.js';
import { latin1Bytes } from '../../../src/internal/latin1.js';

function caught(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}

describe('latin1Bytes', () => {
  test('writes U+00E9 as the one byte 0xE9', () => {
    expect([...latin1Bytes('é')]).toEqual([0xe9]);
  });

  test('writes every code unit 0x00-0xFF as the byte of the same value', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(latin1Bytes(String.fromCharCode(...all))).toEqual(all);
  });

  test('writes ASCII as its ASCII bytes, and the empty string as no bytes', () => {
    expect(latin1Bytes('1 0 obj\n')).toEqual(new TextEncoder().encode('1 0 obj\n'));
    expect(latin1Bytes('')).toHaveLength(0);
  });

  test('throws UnencodableTextError for a code unit above 0xFF, naming the PDF byte string', () => {
    const error = caught(() => latin1Bytes('ab日'));
    expect(error).toBeInstanceOf(UnencodableTextError);
    expect(error).toMatchObject({
      code: 'unencodable-text',
      character: '日',
      codePoint: 0x65e5,
      index: 2,
      fontName: undefined,
      encoding: 'PDF byte string',
    });
    expect((error as Error).message).toBe(
      'A PDF byte string cannot encode "日" (U+65E5) at index 2: it holds only U+0000 to U+00FF',
    );
  });

  test('throws at U+0100, the first code unit above 0xFF', () => {
    expect(caught(() => latin1Bytes('ÿĀ'))).toMatchObject({
      character: 'Ā',
      codePoint: 0x100,
      index: 1,
    });
  });

  test('reports a surrogate pair as one whole character', () => {
    expect(caught(() => latin1Bytes('é😀'))).toMatchObject({
      character: '😀',
      codePoint: 0x1f600,
      index: 1,
    });
  });

  test('reports a lone surrogate by its own value', () => {
    expect(caught(() => latin1Bytes('x\uDC00'))).toMatchObject({
      character: '\uDC00',
      codePoint: 0xdc00,
      index: 1,
    });
  });
});
