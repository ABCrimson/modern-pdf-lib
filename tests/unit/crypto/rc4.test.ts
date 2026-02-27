/**
 * Tests for the pure-JS RC4 implementation.
 *
 * Test vectors from RFC 6229 and various known-good implementations.
 */

import { describe, it, expect } from 'vitest';
import { rc4 } from '../../../src/crypto/rc4.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rc4', () => {
  it('should encrypt and decrypt symmetrically', () => {
    const key = new TextEncoder().encode('Secret');
    const plaintext = new TextEncoder().encode('Hello, World!');

    const encrypted = rc4(key, plaintext);
    expect(encrypted).not.toEqual(plaintext);

    const decrypted = rc4(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should match known RC4 test vector (Key=0x0102030405, PT=0x0000000000)', () => {
    // A well-known RC4 test vector
    const key = hexToBytes('0102030405');
    const plaintext = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);

    const encrypted = rc4(key, plaintext);
    // Known ciphertext for this key/plaintext pair
    expect(bytesToHex(encrypted)).toBe('b2396305f03dc027');
  });

  it('should match known RC4 test vector (Key="Key", PT="Plaintext")', () => {
    const key = new TextEncoder().encode('Key');
    const plaintext = new TextEncoder().encode('Plaintext');

    const encrypted = rc4(key, plaintext);
    // "Plaintext" is 9 bytes -> 9 bytes of ciphertext
    expect(bytesToHex(encrypted)).toBe('bbf316e8d940af0ad3');
  });

  it('should match known RC4 test vector (Key="Wiki", PT="pedia")', () => {
    const key = new TextEncoder().encode('Wiki');
    const plaintext = new TextEncoder().encode('pedia');

    const encrypted = rc4(key, plaintext);
    expect(bytesToHex(encrypted)).toBe('1021bf0420');
  });

  it('should handle empty data', () => {
    const key = new TextEncoder().encode('key');
    const result = rc4(key, new Uint8Array(0));
    expect(result.length).toBe(0);
  });

  it('should handle single byte', () => {
    const key = new TextEncoder().encode('key');
    const plaintext = new Uint8Array([0x42]);

    const encrypted = rc4(key, plaintext);
    expect(encrypted.length).toBe(1);

    const decrypted = rc4(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should handle 256-byte key (maximum)', () => {
    const key = new Uint8Array(256);
    for (let i = 0; i < 256; i++) key[i] = i;

    const plaintext = new TextEncoder().encode('test data');
    const encrypted = rc4(key, plaintext);
    const decrypted = rc4(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should throw for empty key', () => {
    expect(() => rc4(new Uint8Array(0), new Uint8Array([1]))).toThrow('RC4 key length must be 1-256 bytes');
  });

  it('should throw for key longer than 256 bytes', () => {
    expect(() => rc4(new Uint8Array(257), new Uint8Array([1]))).toThrow('RC4 key length must be 1-256 bytes');
  });

  it('should produce different ciphertext with different keys', () => {
    const key1 = new TextEncoder().encode('key1');
    const key2 = new TextEncoder().encode('key2');
    const plaintext = new TextEncoder().encode('same data');

    const enc1 = bytesToHex(rc4(key1, plaintext));
    const enc2 = bytesToHex(rc4(key2, plaintext));
    expect(enc1).not.toBe(enc2);
  });

  it('should not modify the input arrays', () => {
    const key = new Uint8Array([1, 2, 3, 4]);
    const data = new Uint8Array([5, 6, 7, 8]);
    const keyCopy = new Uint8Array(key);
    const dataCopy = new Uint8Array(data);

    rc4(key, data);
    expect(key).toEqual(keyCopy);
    expect(data).toEqual(dataCopy);
  });

  it('should handle large data (1MB)', () => {
    const key = new TextEncoder().encode('test-key');
    const data = new Uint8Array(1024 * 1024);
    for (let i = 0; i < data.length; i++) {
      data[i] = i & 0xff;
    }

    const encrypted = rc4(key, data);
    expect(encrypted.length).toBe(data.length);

    const decrypted = rc4(key, encrypted);
    expect(decrypted).toEqual(data);
  });
});
