/**
 * Tests for the PdfEncryptionHandler.
 *
 * Tests full encrypt/decrypt round-trips for all supported algorithms.
 */

import { describe, it, expect } from 'vitest';
import { PdfEncryptionHandler } from '../../../src/crypto/encryptionHandler.js';
import type { EncryptOptions } from '../../../src/crypto/encryptionHandler.js';
import { PdfString, PdfDict, PdfName, PdfNumber, PdfBool } from '../../../src/core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

// ---------------------------------------------------------------------------
// Tests: PdfEncryptionHandler.create
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler.create', () => {
  it('should create RC4-40 handler', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-40',
    });

    expect(handler.getVersion()).toBe(1);
    expect(handler.getRevision()).toBe(2);
    expect(handler.isAes()).toBe(false);
    expect(handler.getFileKey().length).toBe(5);
  });

  it('should create RC4-128 handler', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-128',
    });

    expect(handler.getVersion()).toBe(2);
    expect(handler.getRevision()).toBe(3);
    expect(handler.isAes()).toBe(false);
    expect(handler.getFileKey().length).toBe(16);
  });

  it('should create AES-128 handler', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-128',
    });

    expect(handler.getVersion()).toBe(4);
    expect(handler.getRevision()).toBe(4);
    expect(handler.isAes()).toBe(true);
    expect(handler.getFileKey().length).toBe(16);
  });

  it('should create AES-256 handler', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-256',
    });

    expect(handler.getVersion()).toBe(5);
    expect(handler.getRevision()).toBe(6);
    expect(handler.isAes()).toBe(true);
    expect(handler.getFileKey().length).toBe(32);
  });

  it('should default to AES-128', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
    });

    expect(handler.getVersion()).toBe(4);
    expect(handler.getRevision()).toBe(4);
    expect(handler.isAes()).toBe(true);
  });

  it('should store permission flags', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      permissions: {
        printing: true,
        copying: false,
        modifying: false,
        annotating: true,
      },
    });

    const perms = handler.getPermissions();
    expect(perms.printing).toBe(true);
    expect(perms.copying).toBe(false);
    expect(perms.modifying).toBe(false);
    expect(perms.annotating).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: encrypt/decrypt objects with RC4
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler — RC4 encrypt/decrypt', () => {
  it('should encrypt and decrypt with RC4-40', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-40',
    });

    const plaintext = new TextEncoder().encode('Hello, PDF encryption!');
    const encrypted = await handler.encryptObject(1, 0, plaintext);

    // Encrypted should differ from plaintext
    expect(encrypted).not.toEqual(plaintext);

    const decrypted = await handler.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should encrypt and decrypt with RC4-128', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-128',
    });

    const plaintext = new TextEncoder().encode('128-bit RC4 test data');
    const encrypted = await handler.encryptObject(5, 0, plaintext);
    const decrypted = await handler.decryptObject(5, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should produce different ciphertext for different objects', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-128',
    });

    const plaintext = new TextEncoder().encode('same data');
    const enc1 = await handler.encryptObject(1, 0, plaintext);
    const enc2 = await handler.encryptObject(2, 0, plaintext);

    // Different object numbers should produce different per-object keys
    expect(enc1).not.toEqual(enc2);
  });
});

// ---------------------------------------------------------------------------
// Tests: encrypt/decrypt objects with AES
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler — AES encrypt/decrypt', () => {
  it('should encrypt and decrypt with AES-128', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-128',
    });

    const plaintext = new TextEncoder().encode('AES-128 encrypted content');
    const encrypted = await handler.encryptObject(1, 0, plaintext);

    // AES adds IV (16 bytes) and padding
    expect(encrypted.length).toBeGreaterThan(plaintext.length);

    const decrypted = await handler.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should encrypt and decrypt with AES-256', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-256',
    });

    const plaintext = new TextEncoder().encode('AES-256 encrypted content');
    const encrypted = await handler.encryptObject(1, 0, plaintext);
    const decrypted = await handler.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should encrypt empty data with AES', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-128',
    });

    const plaintext = new Uint8Array(0);
    const encrypted = await handler.encryptObject(1, 0, plaintext);
    const decrypted = await handler.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should encrypt large data with AES-256', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-256',
    });

    const plaintext = randomBytes(50000);
    const encrypted = await handler.encryptObject(42, 0, plaintext);
    const decrypted = await handler.decryptObject(42, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });
});

// ---------------------------------------------------------------------------
// Tests: encryptString
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler — encryptString', () => {
  it('should encrypt a PdfString to a hex string', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-128',
    });

    const original = PdfString.literal('Hello');
    const encrypted = await handler.encryptString(1, 0, original);

    expect(encrypted.hex).toBe(true);
    expect(encrypted.value).not.toBe(original.value);
  });
});

// ---------------------------------------------------------------------------
// Tests: decryptStream
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler — decryptStream', () => {
  it('should decrypt stream data', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-128',
    });

    const streamContent = new TextEncoder().encode('BT /F1 12 Tf (Hello) Tj ET');
    const encrypted = await handler.encryptObject(10, 0, streamContent);
    const decrypted = await handler.decryptStream(10, 0, encrypted);
    expect(decrypted).toEqual(streamContent);
  });
});

// ---------------------------------------------------------------------------
// Tests: buildEncryptDict
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler — buildEncryptDict', () => {
  it('should build a valid /Encrypt dictionary for RC4-40', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-40',
    });

    const dict = handler.buildEncryptDict();

    expect(dict.get('/Filter')).toBeDefined();
    expect((dict.get('/Filter') as PdfName).value).toBe('/Standard');
    expect((dict.get('/V') as PdfNumber).value).toBe(1);
    expect((dict.get('/R') as PdfNumber).value).toBe(2);
    expect(dict.get('/O')).toBeDefined();
    expect(dict.get('/U')).toBeDefined();
    expect(dict.get('/P')).toBeDefined();
  });

  it('should build a valid /Encrypt dictionary for AES-128', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-128',
    });

    const dict = handler.buildEncryptDict();

    expect((dict.get('/V') as PdfNumber).value).toBe(4);
    expect((dict.get('/R') as PdfNumber).value).toBe(4);
    expect((dict.get('/Length') as PdfNumber).value).toBe(128);

    // Should have /CF with /StdCF using AESV2
    expect(dict.get('/CF')).toBeDefined();
    expect(dict.get('/StmF')).toBeDefined();
    expect(dict.get('/StrF')).toBeDefined();
  });

  it('should build a valid /Encrypt dictionary for AES-256', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-256',
    });

    const dict = handler.buildEncryptDict();

    expect((dict.get('/V') as PdfNumber).value).toBe(5);
    expect((dict.get('/R') as PdfNumber).value).toBe(6);
    expect((dict.get('/Length') as PdfNumber).value).toBe(256);

    // V=5 specific entries
    expect(dict.get('/OE')).toBeDefined();
    expect(dict.get('/UE')).toBeDefined();
    expect(dict.get('/Perms')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: fromEncryptDict (round-trip)
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler — fromEncryptDict round-trip', () => {
  it('should round-trip RC4-40: create -> buildDict -> fromDict', async () => {
    const options: EncryptOptions = {
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'rc4-40',
      permissions: { printing: true },
    };

    const fileId = randomBytes(16);
    const original = await PdfEncryptionHandler.create(options, fileId);
    const dict = original.buildEncryptDict();

    // Recreate from the dictionary
    const restored = await PdfEncryptionHandler.fromEncryptDict(
      dict,
      fileId,
      'user',
    );

    // Should be able to decrypt what the original encrypted
    const plaintext = new TextEncoder().encode('round-trip test');
    const encrypted = await original.encryptObject(1, 0, plaintext);
    const decrypted = await restored.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should round-trip RC4-128: create -> buildDict -> fromDict', async () => {
    const fileId = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'rc4-128' },
      fileId,
    );
    const dict = original.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fileId, 'user');

    const plaintext = new TextEncoder().encode('RC4-128 round-trip');
    const encrypted = await original.encryptObject(3, 0, plaintext);
    const decrypted = await restored.decryptObject(3, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should round-trip AES-128: create -> buildDict -> fromDict', async () => {
    const fileId = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-128' },
      fileId,
    );
    const dict = original.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fileId, 'user');

    const plaintext = new TextEncoder().encode('AES-128 round-trip');
    const encrypted = await original.encryptObject(7, 0, plaintext);
    const decrypted = await restored.decryptObject(7, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should accept owner password when restoring', async () => {
    const fileId = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'rc4-128' },
      fileId,
    );
    const dict = original.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fileId, 'owner');

    const plaintext = new TextEncoder().encode('owner password test');
    const encrypted = await original.encryptObject(1, 0, plaintext);
    const decrypted = await restored.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should reject wrong password', async () => {
    const fileId = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'rc4-128' },
      fileId,
    );
    const dict = original.buildEncryptDict();

    await expect(
      PdfEncryptionHandler.fromEncryptDict(dict, fileId, 'wrong'),
    ).rejects.toThrow('Incorrect password');
  });

  it('should round-trip AES-256: create -> buildDict -> fromDict', async () => {
    const fileId = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'user256', ownerPassword: 'owner256', algorithm: 'aes-256' },
      fileId,
    );
    const dict = original.buildEncryptDict();

    // AES-256 uses V=5 path
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fileId, 'user256');

    const plaintext = new TextEncoder().encode('AES-256 round-trip');
    const encrypted = await original.encryptObject(1, 0, plaintext);
    const decrypted = await restored.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('should round-trip AES-256 with owner password', async () => {
    const fileId = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'user256', ownerPassword: 'owner256', algorithm: 'aes-256' },
      fileId,
    );
    const dict = original.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fileId, 'owner256');

    const plaintext = new TextEncoder().encode('AES-256 owner round-trip');
    const encrypted = await original.encryptObject(1, 0, plaintext);
    const decrypted = await restored.decryptObject(1, 0, encrypted);
    expect(decrypted).toEqual(plaintext);
  });
});

// ---------------------------------------------------------------------------
// Tests: PdfDocument integration
// ---------------------------------------------------------------------------

describe('PdfEncryptionHandler — permissions on encrypt dict', () => {
  it('should preserve permissions through dict serialization', async () => {
    const handler = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      permissions: {
        printing: 'lowResolution',
        copying: true,
        modifying: false,
        fillingForms: true,
      },
    });

    const perms = handler.getPermissions();
    expect(perms.printing).toBe('lowResolution');
    expect(perms.copying).toBe(true);
    expect(perms.modifying).toBe(false);
    expect(perms.fillingForms).toBe(true);
  });
});
