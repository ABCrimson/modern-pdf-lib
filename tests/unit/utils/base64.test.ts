/**
 * Tests for the Base64 encoding/decoding utility module.
 *
 * Covers roundtrip encode/decode, empty input, padding variants,
 * whitespace handling, and known test vectors from RFC 4648.
 */

import { describe, it, expect } from 'vitest';
import { base64Encode, base64Decode } from '../../../src/utils/base64.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function stringToBytes(s: string): Uint8Array {
  return encoder.encode(s);
}

function bytesToString(data: Uint8Array): string {
  return decoder.decode(data);
}

// ---------------------------------------------------------------------------
// RFC 4648 test vectors
// ---------------------------------------------------------------------------

describe('base64Encode', () => {
  it('encodes empty input to empty string', () => {
    expect(base64Encode(new Uint8Array(0))).toBe('');
  });

  it('encodes "f" -> "Zg=="', () => {
    expect(base64Encode(stringToBytes('f'))).toBe('Zg==');
  });

  it('encodes "fo" -> "Zm8="', () => {
    expect(base64Encode(stringToBytes('fo'))).toBe('Zm8=');
  });

  it('encodes "foo" -> "Zm9v"', () => {
    expect(base64Encode(stringToBytes('foo'))).toBe('Zm9v');
  });

  it('encodes "foob" -> "Zm9vYg=="', () => {
    expect(base64Encode(stringToBytes('foob'))).toBe('Zm9vYg==');
  });

  it('encodes "fooba" -> "Zm9vYmE="', () => {
    expect(base64Encode(stringToBytes('fooba'))).toBe('Zm9vYmE=');
  });

  it('encodes "foobar" -> "Zm9vYmFy"', () => {
    expect(base64Encode(stringToBytes('foobar'))).toBe('Zm9vYmFy');
  });

  it('encodes "Hello, World!" correctly', () => {
    expect(base64Encode(stringToBytes('Hello, World!'))).toBe('SGVsbG8sIFdvcmxkIQ==');
  });

  it('encodes binary data with all byte values 0x00-0xFF', () => {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) data[i] = i;
    const encoded = base64Encode(data);
    // Verify it roundtrips correctly
    const decoded = base64Decode(encoded);
    expect(decoded).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// base64Decode
// ---------------------------------------------------------------------------

describe('base64Decode', () => {
  it('decodes empty string to empty array', () => {
    expect(base64Decode('')).toEqual(new Uint8Array(0));
  });

  it('decodes "Zg==" -> "f"', () => {
    expect(bytesToString(base64Decode('Zg=='))).toBe('f');
  });

  it('decodes "Zm8=" -> "fo"', () => {
    expect(bytesToString(base64Decode('Zm8='))).toBe('fo');
  });

  it('decodes "Zm9v" -> "foo"', () => {
    expect(bytesToString(base64Decode('Zm9v'))).toBe('foo');
  });

  it('decodes "Zm9vYg==" -> "foob"', () => {
    expect(bytesToString(base64Decode('Zm9vYg=='))).toBe('foob');
  });

  it('decodes "Zm9vYmE=" -> "fooba"', () => {
    expect(bytesToString(base64Decode('Zm9vYmE='))).toBe('fooba');
  });

  it('decodes "Zm9vYmFy" -> "foobar"', () => {
    expect(bytesToString(base64Decode('Zm9vYmFy'))).toBe('foobar');
  });

  it('decodes "SGVsbG8sIFdvcmxkIQ==" -> "Hello, World!"', () => {
    expect(bytesToString(base64Decode('SGVsbG8sIFdvcmxkIQ=='))).toBe('Hello, World!');
  });

  it('ignores whitespace (spaces, tabs, newlines)', () => {
    const withWhitespace = 'SGVs\nbG8s\r\nIFdv\tcmxk IQ==';
    expect(bytesToString(base64Decode(withWhitespace))).toBe('Hello, World!');
  });

  it('throws on invalid characters', () => {
    expect(() => base64Decode('!!!!')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Roundtrip
// ---------------------------------------------------------------------------

describe('base64 roundtrip', () => {
  it('roundtrips empty data', () => {
    const data = new Uint8Array(0);
    expect(base64Decode(base64Encode(data))).toEqual(data);
  });

  it('roundtrips short strings', () => {
    for (const str of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef']) {
      const data = stringToBytes(str);
      const roundtripped = base64Decode(base64Encode(data));
      expect(roundtripped).toEqual(data);
    }
  });

  it('roundtrips large binary data', () => {
    const data = new Uint8Array(10000);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }
    const roundtripped = base64Decode(base64Encode(data));
    expect(roundtripped).toEqual(data);
  });

  it('roundtrips data with all zero bytes', () => {
    const data = new Uint8Array(100);
    const roundtripped = base64Decode(base64Encode(data));
    expect(roundtripped).toEqual(data);
  });

  it('roundtrips data with all 0xFF bytes', () => {
    const data = new Uint8Array(100).fill(0xff);
    const roundtripped = base64Decode(base64Encode(data));
    expect(roundtripped).toEqual(data);
  });
});
