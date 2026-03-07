/**
 * Tests for the pure-JS MD5 implementation.
 *
 * Test vectors from RFC 1321.
 */

import { describe, it, expect } from 'vitest';
import { md5 } from '../../../src/crypto/md5.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexFromBytes(bytes: Uint8Array): string {
  return bytes.toHex();
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('md5', () => {
  it('should hash empty string correctly (RFC 1321)', () => {
    const hash = md5(new Uint8Array(0));
    expect(hexFromBytes(hash)).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('should hash "a" correctly (RFC 1321)', () => {
    const hash = md5(stringToBytes('a'));
    expect(hexFromBytes(hash)).toBe('0cc175b9c0f1b6a831c399e269772661');
  });

  it('should hash "abc" correctly (RFC 1321)', () => {
    const hash = md5(stringToBytes('abc'));
    expect(hexFromBytes(hash)).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('should hash "message digest" correctly (RFC 1321)', () => {
    const hash = md5(stringToBytes('message digest'));
    expect(hexFromBytes(hash)).toBe('f96b697d7cb7938d525a2f31aaf161d0');
  });

  it('should hash "abcdefghijklmnopqrstuvwxyz" correctly (RFC 1321)', () => {
    const hash = md5(stringToBytes('abcdefghijklmnopqrstuvwxyz'));
    expect(hexFromBytes(hash)).toBe('c3fcd3d76192e4007dfb496cca67e13b');
  });

  it('should hash "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" correctly (RFC 1321)', () => {
    const hash = md5(
      stringToBytes('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
    );
    expect(hexFromBytes(hash)).toBe('d174ab98d277d9f5a5611c2c9f419d9f');
  });

  it('should hash "12345678901234567890123456789012345678901234567890123456789012345678901234567890" correctly (RFC 1321)', () => {
    const hash = md5(
      stringToBytes(
        '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
      ),
    );
    expect(hexFromBytes(hash)).toBe('57edf4a22be3c955ac49da2e2107b67a');
  });

  it('should always return 16 bytes', () => {
    const hash = md5(stringToBytes('test'));
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(16);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hexFromBytes(md5(stringToBytes('hello')));
    const hash2 = hexFromBytes(md5(stringToBytes('world')));
    expect(hash1).not.toBe(hash2);
  });

  it('should produce the same hash for the same input', () => {
    const hash1 = hexFromBytes(md5(stringToBytes('test input')));
    const hash2 = hexFromBytes(md5(stringToBytes('test input')));
    expect(hash1).toBe(hash2);
  });

  it('should handle binary data with null bytes', () => {
    const data = new Uint8Array([0x00, 0x01, 0x02, 0x00, 0xff]);
    const hash = md5(data);
    expect(hash.length).toBe(16);
  });

  it('should handle data longer than one block (64 bytes)', () => {
    const data = new Uint8Array(128);
    for (let i = 0; i < data.length; i++) {
      data[i] = i & 0xff;
    }
    const hash = md5(data);
    expect(hash.length).toBe(16);
  });

  it('should handle data exactly 55 bytes (edge case for padding)', () => {
    const data = new Uint8Array(55);
    data.fill(0x41); // 'A'
    const hash = md5(data);
    expect(hash.length).toBe(16);
  });

  it('should handle data exactly 56 bytes (edge case for padding)', () => {
    const data = new Uint8Array(56);
    data.fill(0x42); // 'B'
    const hash = md5(data);
    expect(hash.length).toBe(16);
  });

  it('should handle data exactly 64 bytes (one full block)', () => {
    const data = new Uint8Array(64);
    data.fill(0x43); // 'C'
    const hash = md5(data);
    expect(hash.length).toBe(16);
  });
});
