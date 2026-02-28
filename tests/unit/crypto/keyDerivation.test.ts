/**
 * Tests for PDF key derivation algorithms.
 *
 * Uses known test vectors where available and verifies round-trip
 * consistency for password verification.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEncryptionKeyR2R4,
  computeOwnerPasswordValue,
  computeUserPasswordHash,
  verifyUserPassword,
  verifyOwnerPassword,
  computeFileEncryptionKey,
  saslprep,
} from '../../../src/crypto/keyDerivation.js';
import type { EncryptDictValues } from '../../../src/crypto/keyDerivation.js';
import { encodePermissions } from '../../../src/crypto/permissions.js';

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
// R=2 (40-bit RC4) tests
// ---------------------------------------------------------------------------

describe('key derivation — R=2 (40-bit RC4)', () => {
  const fileId = hexToBytes('12345678901234567890123456789012');

  it('should compute the owner key (/O) for R=2', () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 2, 40);
    expect(ownerKey.length).toBe(32);
  });

  it('should produce a consistent /O value', () => {
    const o1 = computeOwnerPasswordValue('owner', 'user', 2, 40);
    const o2 = computeOwnerPasswordValue('owner', 'user', 2, 40);
    expect(bytesToHex(o1)).toBe(bytesToHex(o2));
  });

  it('should compute an encryption key for R=2', () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 2, 40);
    const permissions = encodePermissions({ printing: true, copying: true });

    const dict: EncryptDictValues = {
      version: 1,
      revision: 2,
      keyLength: 40,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const key = computeEncryptionKeyR2R4('user', dict, fileId);
    expect(key.length).toBe(5); // 40 bits = 5 bytes
  });

  it('should verify user password with R=2', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 2, 40);
    const permissions = encodePermissions({});

    const dict: EncryptDictValues = {
      version: 1,
      revision: 2,
      keyLength: 40,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    // Compute the correct /U value
    const userKey = computeUserPasswordHash('user', dict, fileId);
    dict.userKey = userKey;

    // Verify should succeed with correct password
    expect(await verifyUserPassword('user', dict, fileId)).toBe(true);

    // Verify should fail with wrong password
    expect(await verifyUserPassword('wrong', dict, fileId)).toBe(false);
  });

  it('should verify owner password with R=2', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 2, 40);
    const permissions = encodePermissions({});

    const dict: EncryptDictValues = {
      version: 1,
      revision: 2,
      keyLength: 40,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    // Compute the correct /U value using user password
    const userKey = computeUserPasswordHash('user', dict, fileId);
    dict.userKey = userKey;

    // Owner password should verify
    expect(await verifyOwnerPassword('owner', dict, fileId)).toBe(true);

    // Wrong owner password should fail
    expect(await verifyOwnerPassword('notowner', dict, fileId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R=3 (128-bit RC4) tests
// ---------------------------------------------------------------------------

describe('key derivation — R=3 (128-bit RC4)', () => {
  const fileId = hexToBytes('abcdef0123456789abcdef0123456789');

  it('should compute the owner key (/O) for R=3', () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 3, 128);
    expect(ownerKey.length).toBe(32);
  });

  it('should compute an encryption key for R=3', () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 3, 128);
    const permissions = encodePermissions({ printing: true });

    const dict: EncryptDictValues = {
      version: 2,
      revision: 3,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const key = computeEncryptionKeyR2R4('user', dict, fileId);
    expect(key.length).toBe(16); // 128 bits = 16 bytes
  });

  it('should verify user password with R=3', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 3, 128);
    const permissions = encodePermissions({ printing: true, copying: true });

    const dict: EncryptDictValues = {
      version: 2,
      revision: 3,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const userKey = computeUserPasswordHash('user', dict, fileId);
    dict.userKey = userKey;

    expect(await verifyUserPassword('user', dict, fileId)).toBe(true);
    expect(await verifyUserPassword('wrong', dict, fileId)).toBe(false);
  });

  it('should verify owner password with R=3', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 3, 128);
    const permissions = encodePermissions({});

    const dict: EncryptDictValues = {
      version: 2,
      revision: 3,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const userKey = computeUserPasswordHash('user', dict, fileId);
    dict.userKey = userKey;

    expect(await verifyOwnerPassword('owner', dict, fileId)).toBe(true);
    expect(await verifyOwnerPassword('notowner', dict, fileId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R=4 (AES-128) tests
// ---------------------------------------------------------------------------

describe('key derivation — R=4 (AES-128)', () => {
  const fileId = hexToBytes('fedcba9876543210fedcba9876543210');

  it('should compute an encryption key for R=4', () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 4, 128);
    const permissions = encodePermissions({ printing: true });

    const dict: EncryptDictValues = {
      version: 4,
      revision: 4,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const key = computeEncryptionKeyR2R4('user', dict, fileId);
    expect(key.length).toBe(16); // 128 bits = 16 bytes
  });

  it('should handle encryptMetadata=false for R=4', () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 4, 128);
    const permissions = encodePermissions({});

    const dictEncrypted: EncryptDictValues = {
      version: 4,
      revision: 4,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const dictNotEncrypted: EncryptDictValues = {
      ...dictEncrypted,
      encryptMetadata: false,
    };

    const key1 = computeEncryptionKeyR2R4('user', dictEncrypted, fileId);
    const key2 = computeEncryptionKeyR2R4('user', dictNotEncrypted, fileId);

    // Keys should differ based on encryptMetadata flag
    expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));
  });

  it('should round-trip user and owner password verification for R=4', async () => {
    const ownerKey = computeOwnerPasswordValue('secret-owner', 'secret-user', 4, 128);
    const permissions = encodePermissions({
      printing: true,
      copying: false,
      annotating: true,
    });

    const dict: EncryptDictValues = {
      version: 4,
      revision: 4,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const userKey = computeUserPasswordHash('secret-user', dict, fileId);
    dict.userKey = userKey;

    // User password verification
    expect(await verifyUserPassword('secret-user', dict, fileId)).toBe(true);
    expect(await verifyUserPassword('wrong', dict, fileId)).toBe(false);

    // Owner password verification
    expect(await verifyOwnerPassword('secret-owner', dict, fileId)).toBe(true);
    expect(await verifyOwnerPassword('wrong', dict, fileId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeFileEncryptionKey (unified)
// ---------------------------------------------------------------------------

describe('computeFileEncryptionKey', () => {
  const fileId = hexToBytes('aabbccddaabbccddaabbccddaabbccdd');

  it('should compute key with user password for R=2', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 2, 40);
    const permissions = encodePermissions({});

    const dict: EncryptDictValues = {
      version: 1,
      revision: 2,
      keyLength: 40,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const userKey = computeUserPasswordHash('user', dict, fileId);
    dict.userKey = userKey;

    const key = await computeFileEncryptionKey('user', dict, fileId);
    expect(key.length).toBe(5);
  });

  it('should compute key with owner password for R=3', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 3, 128);
    const permissions = encodePermissions({});

    const dict: EncryptDictValues = {
      version: 2,
      revision: 3,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const userKey = computeUserPasswordHash('user', dict, fileId);
    dict.userKey = userKey;

    const key = await computeFileEncryptionKey('owner', dict, fileId);
    expect(key.length).toBe(16);
  });

  it('should throw for incorrect password', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', 'user', 3, 128);
    const permissions = encodePermissions({});

    const dict: EncryptDictValues = {
      version: 2,
      revision: 3,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const userKey = computeUserPasswordHash('user', dict, fileId);
    dict.userKey = userKey;

    await expect(
      computeFileEncryptionKey('completely-wrong', dict, fileId),
    ).rejects.toThrow('Incorrect password');
  });

  it('should work with empty user password', async () => {
    const ownerKey = computeOwnerPasswordValue('owner', '', 3, 128);
    const permissions = encodePermissions({ printing: true });

    const dict: EncryptDictValues = {
      version: 2,
      revision: 3,
      keyLength: 128,
      ownerKey,
      userKey: new Uint8Array(32),
      permissions,
      encryptMetadata: true,
    };

    const userKey = computeUserPasswordHash('', dict, fileId);
    dict.userKey = userKey;

    // Empty password should work
    const key = await computeFileEncryptionKey('', dict, fileId);
    expect(key.length).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// SASLprep (RFC 4013) tests
// ---------------------------------------------------------------------------

describe('saslprep', () => {
  it('passes through ASCII passwords unchanged', () => {
    expect(saslprep('password123')).toBe('password123');
    expect(saslprep('Hello World')).toBe('Hello World');
  });

  it('maps non-ASCII spaces to U+0020', () => {
    // NO-BREAK SPACE (U+00A0) → ASCII space
    expect(saslprep('hello\u00A0world')).toBe('hello world');
    // IDEOGRAPHIC SPACE (U+3000) → ASCII space
    expect(saslprep('hello\u3000world')).toBe('hello world');
    // EM SPACE (U+2003) → ASCII space
    expect(saslprep('hello\u2003world')).toBe('hello world');
  });

  it('removes commonly mapped to nothing characters (B.1)', () => {
    // SOFT HYPHEN (U+00AD) → removed
    expect(saslprep('pass\u00ADword')).toBe('password');
    // ZERO WIDTH SPACE (U+200B) → removed
    expect(saslprep('pass\u200Bword')).toBe('password');
    // WORD JOINER (U+2060) → removed
    expect(saslprep('pass\u2060word')).toBe('password');
    // BOM (U+FEFF) → removed
    expect(saslprep('\uFEFFpassword')).toBe('password');
  });

  it('applies NFKC normalization', () => {
    // LATIN SMALL LETTER A WITH RING ABOVE (U+00E5) decomposed → composed
    // "a" + combining ring = "å" (NFC)
    expect(saslprep('a\u030A')).toBe('\u00E5');
    // Full-width digits (U+FF10..FF19) → ASCII digits via NFKC
    expect(saslprep('\uFF11\uFF12\uFF13')).toBe('123');
  });

  it('handles CJK passwords correctly', () => {
    expect(saslprep('密码测试')).toBe('密码测试');
  });

  it('handles Arabic passwords correctly', () => {
    expect(saslprep('كلمة السر')).toBe('كلمة السر');
  });

  it('handles emoji in passwords', () => {
    expect(saslprep('pass🔑word')).toBe('pass🔑word');
  });

  it('throws for ASCII control characters', () => {
    expect(() => saslprep('pass\x00word')).toThrow('prohibited');
    expect(() => saslprep('pass\x07word')).toThrow('prohibited');
  });

  it('handles empty string', () => {
    expect(saslprep('')).toBe('');
  });

  it('handles mixed script password', () => {
    expect(saslprep('пароль123')).toBe('пароль123');
  });
});
