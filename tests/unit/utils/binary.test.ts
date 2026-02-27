/**
 * Tests for the binary utility module.
 *
 * Covers byte concatenation, big-endian read/write roundtrips,
 * text/bytes conversions, hex conversions, GrowableBuffer, and
 * array equality.
 */

import { describe, it, expect } from 'vitest';
import {
  concatBytes,
  writeUint32BE,
  readUint32BE,
  writeUint16BE,
  readUint16BE,
  textToBytes,
  bytesToText,
  bytesToHex,
  hexToBytes,
  GrowableBuffer,
  areEqual,
} from '../../../src/utils/binary.js';

// ---------------------------------------------------------------------------
// concatBytes
// ---------------------------------------------------------------------------

describe('concatBytes', () => {
  it('concatenates multiple arrays', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    const c = new Uint8Array([6]);
    const result = concatBytes(a, b, c);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('returns empty array for no arguments', () => {
    const result = concatBytes();
    expect(result).toEqual(new Uint8Array(0));
    expect(result.length).toBe(0);
  });

  it('returns the same array for a single argument', () => {
    const a = new Uint8Array([10, 20, 30]);
    const result = concatBytes(a);
    expect(result).toBe(a); // same reference for single array
  });

  it('handles empty arrays in the middle', () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array(0);
    const c = new Uint8Array([3, 4]);
    const result = concatBytes(a, b, c);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});

// ---------------------------------------------------------------------------
// Big-endian Uint32 roundtrip
// ---------------------------------------------------------------------------

describe('writeUint32BE / readUint32BE', () => {
  it('roundtrips a value correctly', () => {
    const value = 0xDEADBEEF;
    const bytes = writeUint32BE(value);
    expect(bytes.length).toBe(4);
    const readBack = readUint32BE(bytes, 0);
    expect(readBack).toBe(value >>> 0); // unsigned
  });

  it('handles zero', () => {
    const bytes = writeUint32BE(0);
    expect(readUint32BE(bytes, 0)).toBe(0);
  });

  it('handles max value', () => {
    const bytes = writeUint32BE(0xFFFFFFFF);
    expect(readUint32BE(bytes, 0)).toBe(0xFFFFFFFF);
  });

  it('writes in big-endian order', () => {
    const bytes = writeUint32BE(0x01020304);
    expect(bytes[0]).toBe(0x01);
    expect(bytes[1]).toBe(0x02);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
});

// ---------------------------------------------------------------------------
// Big-endian Uint16 roundtrip
// ---------------------------------------------------------------------------

describe('writeUint16BE / readUint16BE', () => {
  it('roundtrips a value correctly', () => {
    const value = 0xCAFE;
    const bytes = writeUint16BE(value);
    expect(bytes.length).toBe(2);
    const readBack = readUint16BE(bytes, 0);
    expect(readBack).toBe(value);
  });

  it('handles zero', () => {
    const bytes = writeUint16BE(0);
    expect(readUint16BE(bytes, 0)).toBe(0);
  });

  it('handles max value', () => {
    const bytes = writeUint16BE(0xFFFF);
    expect(readUint16BE(bytes, 0)).toBe(0xFFFF);
  });

  it('writes in big-endian order', () => {
    const bytes = writeUint16BE(0x0102);
    expect(bytes[0]).toBe(0x01);
    expect(bytes[1]).toBe(0x02);
  });
});

// ---------------------------------------------------------------------------
// textToBytes / bytesToText roundtrip
// ---------------------------------------------------------------------------

describe('textToBytes / bytesToText', () => {
  it('roundtrips ASCII text', () => {
    const text = 'Hello, World!';
    const bytes = textToBytes(text);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytesToText(bytes)).toBe(text);
  });

  it('roundtrips Unicode text', () => {
    const text = 'Hej varlden! \u00e4\u00f6\u00fc \u{1F600}';
    const bytes = textToBytes(text);
    expect(bytesToText(bytes)).toBe(text);
  });

  it('roundtrips empty string', () => {
    const bytes = textToBytes('');
    expect(bytes.length).toBe(0);
    expect(bytesToText(bytes)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// bytesToHex / hexToBytes roundtrip
// ---------------------------------------------------------------------------

describe('bytesToHex / hexToBytes', () => {
  it('roundtrips bytes correctly', () => {
    const original = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const hex = bytesToHex(original);
    expect(hex).toBe('48656c6c6f');
    const decoded = hexToBytes(hex);
    expect(decoded).toEqual(original);
  });

  it('roundtrips empty array', () => {
    const hex = bytesToHex(new Uint8Array(0));
    expect(hex).toBe('');
    const decoded = hexToBytes('');
    expect(decoded.length).toBe(0);
  });

  it('handles uppercase hex input', () => {
    const decoded = hexToBytes('DEADBEEF');
    expect(decoded).toEqual(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]));
  });

  it('throws on odd-length hex string', () => {
    expect(() => hexToBytes('ABC')).toThrow();
  });

  it('throws on invalid hex characters', () => {
    expect(() => hexToBytes('ZZZZ')).toThrow();
  });

  it('handles all byte values 0-255', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const hex = bytesToHex(allBytes);
    const roundtripped = hexToBytes(hex);
    expect(roundtripped).toEqual(allBytes);
  });
});

// ---------------------------------------------------------------------------
// GrowableBuffer
// ---------------------------------------------------------------------------

describe('GrowableBuffer', () => {
  it('write() appends bytes', () => {
    const buf = new GrowableBuffer(16);
    buf.write(new Uint8Array([1, 2, 3]));
    buf.write(new Uint8Array([4, 5]));
    const result = buf.toUint8Array();
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    expect(buf.length).toBe(5);
  });

  it('writeByte() appends a single byte', () => {
    const buf = new GrowableBuffer(4);
    buf.writeByte(0x41);
    buf.writeByte(0x42);
    buf.writeByte(0x43);
    const result = buf.toUint8Array();
    expect(result).toEqual(new Uint8Array([0x41, 0x42, 0x43]));
    expect(buf.length).toBe(3);
  });

  it('writeString() encodes and appends UTF-8 text', () => {
    const buf = new GrowableBuffer(32);
    buf.writeString('Hello');
    const result = buf.toUint8Array();
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('toUint8Array() returns a copy of the written portion', () => {
    const buf = new GrowableBuffer(1024);
    buf.writeString('Test');
    const result = buf.toUint8Array();
    expect(result.length).toBe(4);
    // Should be a copy, not a view into the internal buffer
    expect(result.length).toBeLessThan(buf.capacity);
  });

  it('grows automatically when capacity is exceeded', () => {
    const buf = new GrowableBuffer(4);
    expect(buf.capacity).toBe(4);
    buf.writeString('This is a longer string that exceeds initial capacity.');
    expect(buf.capacity).toBeGreaterThanOrEqual(buf.length);

    const text = new TextDecoder().decode(buf.toUint8Array());
    expect(text).toBe('This is a longer string that exceeds initial capacity.');
  });

  it('reset() clears the write position but retains capacity', () => {
    const buf = new GrowableBuffer(64);
    buf.writeString('some data');
    const capBefore = buf.capacity;
    buf.reset();
    expect(buf.length).toBe(0);
    expect(buf.capacity).toBe(capBefore);
    // After reset, toUint8Array returns empty
    expect(buf.toUint8Array().length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// areEqual
// ---------------------------------------------------------------------------

describe('areEqual', () => {
  it('returns true for matching arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(areEqual(a, b)).toBe(true);
  });

  it('returns false for non-matching arrays', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 5]);
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false for different-length arrays', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 4]);
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns true for two empty arrays', () => {
    expect(areEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  it('returns true for the same reference', () => {
    const a = new Uint8Array([10, 20, 30]);
    expect(areEqual(a, a)).toBe(true);
  });
});
