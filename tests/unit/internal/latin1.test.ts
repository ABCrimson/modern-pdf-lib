/**
 * latin1Bytes: a PDF byte string (code units 0x00-0xFF) as one byte per code unit.
 * latin1String: the bytes as a byte string, the inverse of latin1Bytes.
 */
import { describe, expect, test } from 'vitest';
import { UnencodableTextError } from '../../../src/errors.js';
import { latin1Bytes, latin1String } from '../../../src/internal/latin1.js';

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

describe('latin1String', () => {
  test('reads no bytes as the empty string', () => {
    expect(latin1String(new Uint8Array(0))).toBe('');
  });

  test('reads every byte 0x00-0xFF as the code unit of the same value', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    const text = latin1String(all);
    expect(text).toHaveLength(256);
    expect(Array.from(text, (unit) => unit.charCodeAt(0))).toEqual(Array.from(all));
  });

  test('reads an input longer than one chunk, and one with a whole number of chunks', () => {
    // 8,192 bytes per String.fromCharCode call: 1 chunk and a part, exactly 2, and 5 and a part.
    for (const length of [8193, 16384, 40_000]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 7) % 256);
      const text = latin1String(bytes);
      expect(text).toHaveLength(length);
      expect(text.charCodeAt(0)).toBe(bytes[0]);
      expect(text.charCodeAt(8191)).toBe(bytes[8191]);
      expect(text.charCodeAt(8192)).toBe(bytes[8192]);
      expect(text.charCodeAt(length - 1)).toBe(bytes[length - 1]);
      expect(latin1Bytes(text)).toEqual(bytes);
    }
  });

  test('reads a view onto the part of a buffer it covers, not the whole buffer', () => {
    const buffer = Uint8Array.from({ length: 20 }, (_, i) => 0xf0 + (i % 16));
    const view = buffer.subarray(5, 9);
    expect(view.byteOffset).toBe(5);
    expect(latin1String(view)).toBe(String.fromCharCode(0xf5, 0xf6, 0xf7, 0xf8));
  });

  test('is the inverse of latin1Bytes', () => {
    const text = String.fromCharCode(0x52, 0xe9, 0x73, 0x00, 0x80, 0xff);
    expect(latin1String(latin1Bytes(text))).toBe(text);
  });
});
