/**
 * Tests for AES-CBC encryption/decryption via Web Crypto API.
 */

import { describe, it, expect } from 'vitest';
import { aesEncryptCBC, aesDecryptCBC } from '../../../src/crypto/aes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('aesEncryptCBC / aesDecryptCBC', () => {
  it('should round-trip encrypt/decrypt with AES-128', async () => {
    const key = randomBytes(16); // AES-128
    const plaintext = new TextEncoder().encode('Hello, AES-128 encryption!');

    const encrypted = await aesEncryptCBC(key, plaintext);
    // Encrypted should be IV (16) + at least 1 block (16)
    expect(encrypted.length).toBeGreaterThanOrEqual(32);

    const decrypted = await aesDecryptCBC(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should round-trip encrypt/decrypt with AES-256', async () => {
    const key = randomBytes(32); // AES-256
    const plaintext = new TextEncoder().encode('Hello, AES-256 encryption!');

    const encrypted = await aesEncryptCBC(key, plaintext);
    expect(encrypted.length).toBeGreaterThanOrEqual(32);

    const decrypted = await aesDecryptCBC(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should round-trip empty plaintext', async () => {
    const key = randomBytes(16);
    const plaintext = new Uint8Array(0);

    const encrypted = await aesEncryptCBC(key, plaintext);
    // IV (16) + one PKCS#7 padding block (16)
    expect(encrypted.length).toBe(32);

    const decrypted = await aesDecryptCBC(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should round-trip data that is exactly 16 bytes', async () => {
    const key = randomBytes(16);
    const plaintext = new Uint8Array(16);
    for (let i = 0; i < 16; i++) plaintext[i] = i;

    const encrypted = await aesEncryptCBC(key, plaintext);
    // IV (16) + 2 blocks (32) due to PKCS#7 padding
    expect(encrypted.length).toBe(48);

    const decrypted = await aesDecryptCBC(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should round-trip large data (10KB)', async () => {
    const key = randomBytes(32);
    const plaintext = randomBytes(10000);

    const encrypted = await aesEncryptCBC(key, plaintext);
    const decrypted = await aesDecryptCBC(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should use provided IV when given', async () => {
    const key = randomBytes(16);
    const iv = new Uint8Array(16).fill(0x42);
    const plaintext = new TextEncoder().encode('test with explicit IV');

    const encrypted = await aesEncryptCBC(key, plaintext, iv);

    // First 16 bytes should be the provided IV
    expect(encrypted.subarray(0, 16)).toEqual(iv);

    const decrypted = await aesDecryptCBC(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should produce different ciphertext with different IVs', async () => {
    const key = randomBytes(16);
    const plaintext = new TextEncoder().encode('same plaintext');

    const iv1 = new Uint8Array(16).fill(0x01);
    const iv2 = new Uint8Array(16).fill(0x02);

    const enc1 = await aesEncryptCBC(key, plaintext, iv1);
    const enc2 = await aesEncryptCBC(key, plaintext, iv2);

    // Ciphertext (after IV) should differ
    const cipher1 = enc1.subarray(16);
    const cipher2 = enc2.subarray(16);
    expect(cipher1).not.toEqual(cipher2);
  });

  it('should produce different ciphertext with different keys', async () => {
    const key1 = randomBytes(16);
    const key2 = randomBytes(16);
    const iv = randomBytes(16);
    const plaintext = new TextEncoder().encode('same plaintext');

    const enc1 = await aesEncryptCBC(key1, plaintext, iv);
    const enc2 = await aesEncryptCBC(key2, plaintext, iv);

    expect(enc1.subarray(16)).not.toEqual(enc2.subarray(16));
  });

  it('should reject invalid key size', async () => {
    const key = randomBytes(24); // Not 16 or 32
    const plaintext = new TextEncoder().encode('test');

    await expect(aesEncryptCBC(key, plaintext)).rejects.toThrow('AES key must be 16 bytes');
  });

  it('should reject invalid IV size', async () => {
    const key = randomBytes(16);
    const iv = randomBytes(8); // Not 16
    const plaintext = new TextEncoder().encode('test');

    await expect(aesEncryptCBC(key, plaintext, iv)).rejects.toThrow('AES-CBC IV must be 16 bytes');
  });

  it('should reject ciphertext shorter than 32 bytes on decrypt', async () => {
    const key = randomBytes(16);
    const shortData = randomBytes(16); // Only IV, no ciphertext

    await expect(aesDecryptCBC(key, shortData)).rejects.toThrow(
      'AES-CBC ciphertext must be at least 32 bytes',
    );
  });

  it('should reject ciphertext with non-block-aligned length', async () => {
    const key = randomBytes(16);
    // 16 (IV) + 17 (not a multiple of 16)
    const badData = randomBytes(33);

    await expect(aesDecryptCBC(key, badData)).rejects.toThrow(
      'AES-CBC ciphertext length',
    );
  });

  it('should handle binary data with all byte values', async () => {
    const key = randomBytes(16);
    const plaintext = new Uint8Array(256);
    for (let i = 0; i < 256; i++) plaintext[i] = i;

    const encrypted = await aesEncryptCBC(key, plaintext);
    const decrypted = await aesDecryptCBC(key, encrypted);
    expect(decrypted).toEqual(plaintext);
  });
});
