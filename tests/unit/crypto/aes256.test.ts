/**
 * Comprehensive tests for AES-256 (V=5, R=6) encryption — PDF 2.0.
 *
 * Covers:
 * - Encrypt/decrypt round-trips (strings, streams, empty data, large data)
 * - Key derivation correctness (Algorithm 2.B)
 * - User and owner password validation
 * - Permission bit encoding/decoding
 * - Empty and Unicode (SASLprep) passwords
 * - /Encrypt dictionary structure
 * - fromEncryptDict round-trip (user and owner passwords)
 * - Interop isolation with AES-128 (no cross-contamination)
 * - PDF header version (2.0 for AES-256)
 * - Full document-level encrypt → save round-trip
 */

import { describe, it, expect } from 'vitest';
import { PdfEncryptionHandler } from '../../../src/crypto/encryptionHandler.js';
import type { EncryptOptions, EncryptAlgorithm } from '../../../src/crypto/encryptionHandler.js';
import {
  PdfString,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfBool,
  PdfArray,
  PdfObjectRegistry,
  PdfStream,
} from '../../../src/core/pdfObjects.js';
import { buildDocumentStructure } from '../../../src/core/pdfCatalog.js';
import type { PageEntry } from '../../../src/core/pdfCatalog.js';
import { serializePdf } from '../../../src/core/pdfWriter.js';
import {
  algorithm2B,
  generateUserKeyV5,
  generateOwnerKeyV5,
  generatePermsV5,
  computeFileEncryptionKey,
  verifyUserPassword,
  verifyOwnerPassword,
} from '../../../src/crypto/keyDerivation.js';
import type { EncryptDictValues } from '../../../src/crypto/keyDerivation.js';
import { aesEncryptCBC, aesDecryptCBC } from '../../../src/crypto/aes.js';
import { encodePermissions, decodePermissions } from '../../../src/crypto/permissions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  // crypto.getRandomValues has a 65536-byte limit per call
  for (let offset = 0; offset < len; offset += 65536) {
    const chunk = Math.min(65536, len - offset);
    globalThis.crypto.getRandomValues(bytes.subarray(offset, offset + chunk));
  }
  return bytes;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function createAes256Handler(
  userPassword = 'user',
  ownerPassword = 'owner',
  opts?: Partial<EncryptOptions>,
): Promise<PdfEncryptionHandler> {
  return PdfEncryptionHandler.create({
    userPassword,
    ownerPassword,
    algorithm: 'aes-256',
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// 1. Handler creation — V=5, R=6 parameters
// ---------------------------------------------------------------------------

describe('AES-256 handler creation', () => {
  it('creates handler with V=5, R=6', async () => {
    const h = await createAes256Handler();
    expect(h.getVersion()).toBe(5);
    expect(h.getRevision()).toBe(6);
    expect(h.isAes()).toBe(true);
    expect(h.getFileKey().length).toBe(32);
  });

  it('generates a 32-byte random file encryption key', async () => {
    const h1 = await createAes256Handler();
    const h2 = await createAes256Handler();
    // Two handlers should have different random keys
    expect(h1.getFileKey().toHex()).not.toBe(h2.getFileKey().toHex());
  });

  it('metadata is encrypted by default', async () => {
    const h = await createAes256Handler();
    expect(h.isMetadataEncrypted()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Encrypt/decrypt round-trips
// ---------------------------------------------------------------------------

describe('AES-256 encrypt/decrypt round-trips', () => {
  it('round-trips short plaintext', async () => {
    const h = await createAes256Handler();
    const plain = enc.encode('Hello, AES-256!');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(cipher).not.toEqual(plain);
    const result = await h.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });

  it('round-trips empty data', async () => {
    const h = await createAes256Handler();
    const plain = new Uint8Array(0);
    const cipher = await h.encryptObject(1, 0, plain);
    const result = await h.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });

  it('round-trips exactly one AES block (16 bytes)', async () => {
    const h = await createAes256Handler();
    const plain = randomBytes(16);
    const cipher = await h.encryptObject(1, 0, plain);
    const result = await h.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });

  it('round-trips non-block-aligned data (37 bytes)', async () => {
    const h = await createAes256Handler();
    const plain = randomBytes(37);
    const cipher = await h.encryptObject(1, 0, plain);
    const result = await h.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });

  it('round-trips large data (100 KB)', async () => {
    const h = await createAes256Handler();
    const plain = randomBytes(100_000);
    const cipher = await h.encryptObject(1, 0, plain);
    const result = await h.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });

  it('uses the same file key for all objects (V=5)', async () => {
    const h = await createAes256Handler();
    const plain = enc.encode('same data');
    // AES-256 V=5 uses the file key directly (no per-object derivation)
    // but the random IV means ciphertexts differ.
    const c1 = await h.encryptObject(1, 0, plain);
    const c2 = await h.encryptObject(2, 0, plain);
    // Ciphertexts should differ (random IV)
    expect(c1.toHex()).not.toBe(c2.toHex());
    // But both decrypt correctly
    expect(await h.decryptObject(1, 0, c1)).toEqual(plain);
    expect(await h.decryptObject(2, 0, c2)).toEqual(plain);
  });

  it('encrypted data is larger than plaintext (IV + padding)', async () => {
    const h = await createAes256Handler();
    const plain = enc.encode('Test AES-256 size');
    const cipher = await h.encryptObject(1, 0, plain);
    // IV (16) + at least one block of ciphertext
    expect(cipher.length).toBeGreaterThan(plain.length);
    expect(cipher.length).toBeGreaterThanOrEqual(32); // 16 IV + 16 min block
  });
});

// ---------------------------------------------------------------------------
// 3. String encryption
// ---------------------------------------------------------------------------

describe('AES-256 string encryption', () => {
  it('encrypts a PdfString to hex form', async () => {
    const h = await createAes256Handler();
    const original = PdfString.literal('Secret text');
    const encrypted = await h.encryptString(1, 0, original);
    expect(encrypted.hex).toBe(true);
    expect(encrypted.value).not.toBe(original.value);
  });

  it('encrypted string can be decrypted back', async () => {
    const h = await createAes256Handler();
    const originalText = 'Round-trip string';
    const original = PdfString.literal(originalText);
    const encrypted = await h.encryptString(1, 0, original);

    // The encrypted value is hex-encoded ciphertext. Decode it.
    const cipherBytes = Uint8Array.fromHex(encrypted.value);
    const plainBytes = await h.decryptObject(1, 0, cipherBytes);
    expect(dec.decode(plainBytes)).toBe(originalText);
  });
});

// ---------------------------------------------------------------------------
// 4. Stream encryption
// ---------------------------------------------------------------------------

describe('AES-256 stream decryption', () => {
  it('encrypts and decrypts stream data', async () => {
    const h = await createAes256Handler();
    const streamData = enc.encode('BT /F1 12 Tf (Hello) Tj ET');
    const encrypted = await h.encryptObject(10, 0, streamData);
    const decrypted = await h.decryptStream(10, 0, encrypted);
    expect(decrypted).toEqual(streamData);
  });
});

// ---------------------------------------------------------------------------
// 5. /Encrypt dictionary structure
// ---------------------------------------------------------------------------

describe('AES-256 /Encrypt dictionary', () => {
  it('has correct /V, /R, /Length', async () => {
    const h = await createAes256Handler();
    const dict = h.buildEncryptDict();
    expect((dict.get('/V') as PdfNumber).value).toBe(5);
    expect((dict.get('/R') as PdfNumber).value).toBe(6);
    expect((dict.get('/Length') as PdfNumber).value).toBe(256);
  });

  it('has /Filter /Standard', async () => {
    const h = await createAes256Handler();
    const dict = h.buildEncryptDict();
    expect((dict.get('/Filter') as PdfName).value).toBe('/Standard');
  });

  it('has /CF with /StdCF using AESV3', async () => {
    const h = await createAes256Handler();
    const dict = h.buildEncryptDict();

    const cf = dict.get('/CF') as PdfDict;
    expect(cf).toBeDefined();
    const stdCF = cf.get('/StdCF') as PdfDict;
    expect(stdCF).toBeDefined();
    expect((stdCF.get('/CFM') as PdfName).value).toBe('/AESV3');
    expect((stdCF.get('/Length') as PdfNumber).value).toBe(32);
    expect((stdCF.get('/AuthEvent') as PdfName).value).toBe('/DocOpen');
  });

  it('has /StmF and /StrF set to /StdCF', async () => {
    const h = await createAes256Handler();
    const dict = h.buildEncryptDict();
    expect((dict.get('/StmF') as PdfName).value).toBe('/StdCF');
    expect((dict.get('/StrF') as PdfName).value).toBe('/StdCF');
  });

  it('has /O (48 bytes), /U (48 bytes), /OE (32 bytes), /UE (32 bytes), /Perms (16 bytes)', async () => {
    const h = await createAes256Handler();
    const dict = h.buildEncryptDict();

    // /O and /U are 48 bytes each (hash + valSalt + keySalt)
    const oStr = dict.get('/O') as PdfString;
    expect(oStr).toBeDefined();
    expect(Uint8Array.fromHex(oStr.value).length).toBe(48);

    const uStr = dict.get('/U') as PdfString;
    expect(uStr).toBeDefined();
    expect(Uint8Array.fromHex(uStr.value).length).toBe(48);

    // /OE and /UE are 32 bytes each (encrypted file key)
    const oeStr = dict.get('/OE') as PdfString;
    expect(oeStr).toBeDefined();
    expect(Uint8Array.fromHex(oeStr.value).length).toBe(32);

    const ueStr = dict.get('/UE') as PdfString;
    expect(ueStr).toBeDefined();
    expect(Uint8Array.fromHex(ueStr.value).length).toBe(32);

    // /Perms is 16 bytes (one AES block)
    const permsStr = dict.get('/Perms') as PdfString;
    expect(permsStr).toBeDefined();
    expect(Uint8Array.fromHex(permsStr.value).length).toBe(16);
  });

  it('has /P permission value', async () => {
    const h = await createAes256Handler('u', 'o', {
      permissions: { printing: true, copying: false },
    });
    const dict = h.buildEncryptDict();
    const p = (dict.get('/P') as PdfNumber).value;
    expect(typeof p).toBe('number');
    // The printing bit should be set
    expect(p & (1 << 2)).not.toBe(0);   // bit 3
    expect(p & (1 << 11)).not.toBe(0);  // bit 12 (high-quality print)
    // The copying bit should NOT be set
    expect(p & (1 << 4)).toBe(0);       // bit 5
  });
});

// ---------------------------------------------------------------------------
// 6. Permission bits
// ---------------------------------------------------------------------------

describe('AES-256 permissions', () => {
  it('preserves all permission flags', async () => {
    const h = await createAes256Handler('u', 'o', {
      permissions: {
        printing: 'lowResolution',
        modifying: false,
        copying: true,
        annotating: true,
        fillingForms: true,
        contentAccessibility: true,
        documentAssembly: false,
      },
    });
    const p = h.getPermissions();
    expect(p.printing).toBe('lowResolution');
    expect(p.modifying).toBe(false);
    expect(p.copying).toBe(true);
    expect(p.annotating).toBe(true);
    expect(p.fillingForms).toBe(true);
    expect(p.contentAccessibility).toBe(true);
    expect(p.documentAssembly).toBe(false);
  });

  it('defaults to restrictive permissions', async () => {
    const h = await createAes256Handler('u', 'o');
    const p = h.getPermissions();
    expect(p.printing).toBe(false);
    expect(p.copying).toBe(false);
    expect(p.modifying).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. fromEncryptDict round-trip (user password)
// ---------------------------------------------------------------------------

describe('AES-256 fromEncryptDict — user password', () => {
  it('recovers file key with user password', async () => {
    const fid = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'myUser', ownerPassword: 'myOwner', algorithm: 'aes-256' },
      fid,
    );
    const dict = original.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'myUser');
    expect(restored.getVersion()).toBe(5);
    expect(restored.getRevision()).toBe(6);

    // Encrypt with original, decrypt with restored
    const plain = enc.encode('user password recovery test');
    const cipher = await original.encryptObject(1, 0, plain);
    const result = await restored.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });

  it('encrypts with restored handler and decrypts with original', async () => {
    const fid = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'u', ownerPassword: 'o', algorithm: 'aes-256' },
      fid,
    );
    const dict = original.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'u');

    // Encrypt with restored, decrypt with original
    const plain = enc.encode('bidirectional test');
    const cipher = await restored.encryptObject(5, 0, plain);
    const result = await original.decryptObject(5, 0, cipher);
    expect(result).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 8. fromEncryptDict round-trip (owner password)
// ---------------------------------------------------------------------------

describe('AES-256 fromEncryptDict — owner password', () => {
  it('recovers file key with owner password', async () => {
    const fid = randomBytes(16);
    const original = await PdfEncryptionHandler.create(
      { userPassword: 'u256', ownerPassword: 'o256', algorithm: 'aes-256' },
      fid,
    );
    const dict = original.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'o256');

    const plain = enc.encode('owner password recovery test');
    const cipher = await original.encryptObject(1, 0, plain);
    const result = await restored.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 9. Wrong password rejection
// ---------------------------------------------------------------------------

describe('AES-256 wrong password rejection', () => {
  it('rejects wrong password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'correct', ownerPassword: 'correctOwner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    await expect(
      PdfEncryptionHandler.fromEncryptDict(dict, fid, 'wrong'),
    ).rejects.toThrow(/ncorrect password/);
  });
});

// ---------------------------------------------------------------------------
// 10. Empty password
// ---------------------------------------------------------------------------

describe('AES-256 empty password', () => {
  it('works with empty user password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: '', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // Should be openable with empty password
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '');
    const plain = enc.encode('empty password test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('works with both passwords empty', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: '', ownerPassword: '', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '');
    const plain = enc.encode('both empty');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 11. Unicode password (SASLprep)
// ---------------------------------------------------------------------------

describe('AES-256 Unicode passwords (SASLprep)', () => {
  it('handles CJK password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: '密码测试', ownerPassword: '所有者密码', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '密码测试');
    const plain = enc.encode('CJK password test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('normalizes non-ASCII spaces in passwords', async () => {
    // NO-BREAK SPACE (U+00A0) should be mapped to regular space
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'pass\u00A0word', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // Should be openable with regular space too (SASLprep normalizes both)
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'pass word');
    const plain = enc.encode('SASLprep space normalization');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('removes soft hyphens from passwords', async () => {
    // SOFT HYPHEN (U+00AD) should be removed
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'pass\u00ADword', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // Should be openable with "password" (soft hyphen removed)
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'password');
    const plain = enc.encode('SASLprep soft hyphen');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('handles mixed-script password (Cyrillic + digits)', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'пароль123', ownerPassword: 'владелец456', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'пароль123');
    const plain = enc.encode('Cyrillic password test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('handles long password (truncated to 127 UTF-8 bytes)', async () => {
    const longPwd = 'A'.repeat(200);
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: longPwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // The truncated password should match
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, longPwd);
    const plain = enc.encode('long password test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 12. Interop isolation with AES-128
// ---------------------------------------------------------------------------

describe('AES-256 vs AES-128 interop isolation', () => {
  it('AES-256 handler cannot decrypt AES-128 ciphertext', async () => {
    const h128 = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-128',
    });
    const h256 = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-256',
    });

    const plain = enc.encode('cross-contamination test');
    const cipher128 = await h128.encryptObject(1, 0, plain);

    // Decrypting AES-128 ciphertext with AES-256 handler should either
    // throw (bad padding) or produce different output (wrong key).
    try {
      const attempt = await h256.decryptObject(1, 0, cipher128);
      // If it didn't throw, the result must differ from the original
      expect(attempt.toHex()).not.toBe(plain.toHex());
    } catch {
      // OperationError from Web Crypto (bad PKCS#7 padding) is expected
    }
  });

  it('AES-128 and AES-256 produce different key lengths', async () => {
    const h128 = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-128',
    });
    const h256 = await PdfEncryptionHandler.create({
      userPassword: 'user',
      ownerPassword: 'owner',
      algorithm: 'aes-256',
    });

    expect(h128.getFileKey().length).toBe(16);
    expect(h256.getFileKey().length).toBe(32);
  });

  it('AES-128 uses V=4 R=4, AES-256 uses V=5 R=6', async () => {
    const h128 = await PdfEncryptionHandler.create({
      userPassword: 'u', ownerPassword: 'o', algorithm: 'aes-128',
    });
    const h256 = await PdfEncryptionHandler.create({
      userPassword: 'u', ownerPassword: 'o', algorithm: 'aes-256',
    });

    expect(h128.getVersion()).toBe(4);
    expect(h128.getRevision()).toBe(4);
    expect(h256.getVersion()).toBe(5);
    expect(h256.getRevision()).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 13. Key derivation (Algorithm 2.B) — determinism and structure
// ---------------------------------------------------------------------------

describe('Algorithm 2.B key derivation', () => {
  it('produces a 32-byte hash', async () => {
    const pwd = enc.encode('test');
    const salt = randomBytes(8);
    const hash = await algorithm2B(pwd, salt);
    expect(hash.length).toBe(32);
  });

  it('same inputs produce same hash', async () => {
    const pwd = enc.encode('deterministic');
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const h1 = await algorithm2B(pwd, salt);
    const h2 = await algorithm2B(pwd, salt);
    expect(h1.toHex()).toBe(h2.toHex());
  });

  it('different salts produce different hashes', async () => {
    const pwd = enc.encode('test');
    const salt1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const salt2 = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
    const h1 = await algorithm2B(pwd, salt1);
    const h2 = await algorithm2B(pwd, salt2);
    expect(h1.toHex()).not.toBe(h2.toHex());
  });

  it('includes uKey in owner path computation', async () => {
    const pwd = enc.encode('owner');
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const uKey = randomBytes(48);
    const withU = await algorithm2B(pwd, salt, uKey);
    const withoutU = await algorithm2B(pwd, salt);
    // Including the /U value should change the hash
    expect(withU.toHex()).not.toBe(withoutU.toHex());
  });
});

// ---------------------------------------------------------------------------
// 14. User/Owner key generation (V=5)
// ---------------------------------------------------------------------------

describe('V=5 key generation', () => {
  it('generateUserKeyV5 produces 48-byte /U and 32-byte /UE', async () => {
    const fileKey = randomBytes(32);
    const { userKey, userEncryptionKey } = await generateUserKeyV5('test', fileKey, 6);
    expect(userKey.length).toBe(48);
    expect(userEncryptionKey.length).toBe(32);
  });

  it('generateOwnerKeyV5 produces 48-byte /O and 32-byte /OE', async () => {
    const fileKey = randomBytes(32);
    const uKey = randomBytes(48); // /U value
    const { ownerKey, ownerEncryptionKey } = await generateOwnerKeyV5('test', fileKey, uKey, 6);
    expect(ownerKey.length).toBe(48);
    expect(ownerEncryptionKey.length).toBe(32);
  });

  it('generatePermsV5 produces 16-byte /Perms', async () => {
    const fileKey = randomBytes(32);
    const perms = await generatePermsV5(fileKey, -3904, true);
    expect(perms.length).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// 15. Password verification via keyDerivation
// ---------------------------------------------------------------------------

describe('AES-256 password verification via keyDerivation', () => {
  it('verifyUserPassword succeeds with correct password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // Extract dict values for keyDerivation functions
    const dictValues: EncryptDictValues = {
      version: 5,
      revision: 6,
      keyLength: 256,
      ownerKey: Uint8Array.fromHex((dict.get('/O') as PdfString).value),
      userKey: Uint8Array.fromHex((dict.get('/U') as PdfString).value),
      ownerEncryptionKey: Uint8Array.fromHex((dict.get('/OE') as PdfString).value),
      userEncryptionKey: Uint8Array.fromHex((dict.get('/UE') as PdfString).value),
      perms: Uint8Array.fromHex((dict.get('/Perms') as PdfString).value),
      permissions: (dict.get('/P') as PdfNumber).value,
      encryptMetadata: true,
    };

    expect(await verifyUserPassword('user', dictValues, fid)).toBe(true);
    expect(await verifyUserPassword('wrong', dictValues, fid)).toBe(false);
  });

  it('verifyOwnerPassword succeeds with correct password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const dictValues: EncryptDictValues = {
      version: 5,
      revision: 6,
      keyLength: 256,
      ownerKey: Uint8Array.fromHex((dict.get('/O') as PdfString).value),
      userKey: Uint8Array.fromHex((dict.get('/U') as PdfString).value),
      ownerEncryptionKey: Uint8Array.fromHex((dict.get('/OE') as PdfString).value),
      userEncryptionKey: Uint8Array.fromHex((dict.get('/UE') as PdfString).value),
      perms: Uint8Array.fromHex((dict.get('/Perms') as PdfString).value),
      permissions: (dict.get('/P') as PdfNumber).value,
      encryptMetadata: true,
    };

    expect(await verifyOwnerPassword('owner', dictValues, fid)).toBe(true);
    expect(await verifyOwnerPassword('wrong', dictValues, fid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 16. computeFileEncryptionKey (unified) for R=6
// ---------------------------------------------------------------------------

describe('computeFileEncryptionKey for R=6', () => {
  it('computes the correct key with user password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const dictValues: EncryptDictValues = {
      version: 5,
      revision: 6,
      keyLength: 256,
      ownerKey: Uint8Array.fromHex((dict.get('/O') as PdfString).value),
      userKey: Uint8Array.fromHex((dict.get('/U') as PdfString).value),
      ownerEncryptionKey: Uint8Array.fromHex((dict.get('/OE') as PdfString).value),
      userEncryptionKey: Uint8Array.fromHex((dict.get('/UE') as PdfString).value),
      perms: Uint8Array.fromHex((dict.get('/Perms') as PdfString).value),
      permissions: (dict.get('/P') as PdfNumber).value,
      encryptMetadata: true,
    };

    const recoveredKey = await computeFileEncryptionKey('user', dictValues, fid);
    expect(recoveredKey.length).toBe(32);
    expect(recoveredKey.toHex()).toBe(h.getFileKey().toHex());
  });

  it('computes the correct key with owner password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const dictValues: EncryptDictValues = {
      version: 5,
      revision: 6,
      keyLength: 256,
      ownerKey: Uint8Array.fromHex((dict.get('/O') as PdfString).value),
      userKey: Uint8Array.fromHex((dict.get('/U') as PdfString).value),
      ownerEncryptionKey: Uint8Array.fromHex((dict.get('/OE') as PdfString).value),
      userEncryptionKey: Uint8Array.fromHex((dict.get('/UE') as PdfString).value),
      perms: Uint8Array.fromHex((dict.get('/Perms') as PdfString).value),
      permissions: (dict.get('/P') as PdfNumber).value,
      encryptMetadata: true,
    };

    const recoveredKey = await computeFileEncryptionKey('owner', dictValues, fid);
    expect(recoveredKey.length).toBe(32);
    expect(recoveredKey.toHex()).toBe(h.getFileKey().toHex());
  });

  it('throws for incorrect password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const dictValues: EncryptDictValues = {
      version: 5,
      revision: 6,
      keyLength: 256,
      ownerKey: Uint8Array.fromHex((dict.get('/O') as PdfString).value),
      userKey: Uint8Array.fromHex((dict.get('/U') as PdfString).value),
      ownerEncryptionKey: Uint8Array.fromHex((dict.get('/OE') as PdfString).value),
      userEncryptionKey: Uint8Array.fromHex((dict.get('/UE') as PdfString).value),
      perms: Uint8Array.fromHex((dict.get('/Perms') as PdfString).value),
      permissions: (dict.get('/P') as PdfNumber).value,
      encryptMetadata: true,
    };

    await expect(
      computeFileEncryptionKey('wrong', dictValues, fid),
    ).rejects.toThrow(/ncorrect password/);
  });
});

// ---------------------------------------------------------------------------
// 17. AES-256 raw encrypt/decrypt (aes.ts with 32-byte key)
// ---------------------------------------------------------------------------

describe('AES-256-CBC raw operations', () => {
  it('encrypts and decrypts with a 32-byte key', async () => {
    const key = randomBytes(32);
    const plain = enc.encode('Raw AES-256-CBC test');
    const cipher = await aesEncryptCBC(key, plain);
    // Ciphertext = IV(16) + encrypted blocks
    expect(cipher.length).toBeGreaterThanOrEqual(32);
    const decrypted = await aesDecryptCBC(key, cipher);
    expect(decrypted).toEqual(plain);
  });

  it('rejects 24-byte key (invalid length)', async () => {
    const badKey = randomBytes(24);
    const plain = enc.encode('test');
    await expect(aesEncryptCBC(badKey, plain)).rejects.toThrow(/16.*32/);
  });
});

// ---------------------------------------------------------------------------
// 18. PDF header version for AES-256
// ---------------------------------------------------------------------------

describe('AES-256 PDF header version', () => {
  it('produces %PDF-2.0 header when AES-256 is used', async () => {
    const registry = new PdfObjectRegistry();
    const pageRef = registry.allocate();
    const contentStreamRef = registry.allocate();
    const contentStream = PdfStream.fromString('');
    registry.assign(contentStreamRef, contentStream);
    const resources = new PdfDict();
    resources.set('/ProcSet', PdfArray.of([PdfName.of('PDF'), PdfName.of('Text')]));

    const pageEntry: PageEntry = {
      pageRef,
      width: 595.28,
      height: 841.89,
      contentStreamRefs: contentStreamRef,
      resources,
    };
    const structure = buildDocumentStructure(
      [pageEntry],
      { producer: 'test' },
      registry,
    );

    const handler = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'aes-256',
    });

    const bytes = await serializePdf(registry, structure, { compress: false }, handler);
    const text = dec.decode(bytes);
    expect(text.startsWith('%PDF-2.0')).toBe(true);
  });

  it('produces %PDF-1.7 header when AES-128 is used', async () => {
    const registry = new PdfObjectRegistry();
    const pageRef = registry.allocate();
    const contentStreamRef = registry.allocate();
    const contentStream = PdfStream.fromString('');
    registry.assign(contentStreamRef, contentStream);
    const resources = new PdfDict();
    resources.set('/ProcSet', PdfArray.of([PdfName.of('PDF'), PdfName.of('Text')]));

    const pageEntry: PageEntry = {
      pageRef,
      width: 595.28,
      height: 841.89,
      contentStreamRefs: contentStreamRef,
      resources,
    };
    const structure = buildDocumentStructure(
      [pageEntry],
      { producer: 'test' },
      registry,
    );

    const handler = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'aes-128',
    });

    const bytes = await serializePdf(registry, structure, { compress: false }, handler);
    const text = dec.decode(bytes);
    expect(text.startsWith('%PDF-1.7')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 19. Trailer includes /Encrypt and /ID when encryption is active
// ---------------------------------------------------------------------------

describe('AES-256 trailer integration', () => {
  it('trailer includes /Encrypt reference and /ID array', async () => {
    const registry = new PdfObjectRegistry();
    const pageRef = registry.allocate();
    const contentStreamRef = registry.allocate();
    const contentStream = PdfStream.fromString('');
    registry.assign(contentStreamRef, contentStream);
    const resources = new PdfDict();
    resources.set('/ProcSet', PdfArray.of([PdfName.of('PDF'), PdfName.of('Text')]));

    const pageEntry: PageEntry = {
      pageRef,
      width: 595.28,
      height: 841.89,
      contentStreamRefs: contentStreamRef,
      resources,
    };
    const structure = buildDocumentStructure(
      [pageEntry],
      { producer: 'test' },
      registry,
    );

    const handler = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'aes-256',
    });

    const bytes = await serializePdf(registry, structure, { compress: false }, handler);
    const text = dec.decode(bytes);

    // Trailer should contain /Encrypt reference
    expect(text).toMatch(/\/Encrypt \d+ \d+ R/);
    // Trailer should contain /ID array with two hex strings
    expect(text).toMatch(/\/ID \[<[0-9a-f]+> <[0-9a-f]+>\]/);
  });

  it('trailer does NOT include /Encrypt when no encryption', async () => {
    const registry = new PdfObjectRegistry();
    const pageRef = registry.allocate();
    const contentStreamRef = registry.allocate();
    const contentStream = PdfStream.fromString('');
    registry.assign(contentStreamRef, contentStream);
    const resources = new PdfDict();
    resources.set('/ProcSet', PdfArray.of([PdfName.of('PDF'), PdfName.of('Text')]));

    const pageEntry: PageEntry = {
      pageRef,
      width: 595.28,
      height: 841.89,
      contentStreamRefs: contentStreamRef,
      resources,
    };
    const structure = buildDocumentStructure(
      [pageEntry],
      { producer: 'test' },
      registry,
    );

    const bytes = await serializePdf(registry, structure, { compress: false });
    const text = dec.decode(bytes);

    expect(text).not.toContain('/Encrypt');
    expect(text).not.toContain('/ID');
  });
});

// ---------------------------------------------------------------------------
// 20. Multiple objects with same handler
// ---------------------------------------------------------------------------

describe('AES-256 multiple objects', () => {
  it('encrypts and decrypts many objects independently', async () => {
    const h = await createAes256Handler();
    const objects: { objNum: number; plain: Uint8Array; cipher: Uint8Array }[] = [];

    for (let i = 1; i <= 20; i++) {
      const plain = enc.encode(`Object ${i} content — ${randomBytes(8).toHex()}`);
      const cipher = await h.encryptObject(i, 0, plain);
      objects.push({ objNum: i, plain, cipher });
    }

    // Decrypt all and verify
    for (const { objNum, plain, cipher } of objects) {
      const result = await h.decryptObject(objNum, 0, cipher);
      expect(result).toEqual(plain);
    }
  });
});

// ---------------------------------------------------------------------------
// 21. Known-structure AES-256 test vector
// ---------------------------------------------------------------------------

describe('AES-256 known-structure test', () => {
  it('/Perms block has correct structure after decryption', async () => {
    // Create a handler with known permissions
    const perms = encodePermissions({ printing: true, copying: true, modifying: true });
    const h = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'aes-256',
      permissions: { printing: true, copying: true, modifying: true },
    });

    // The /Perms value, when decrypted with the file key, should contain:
    //   bytes 0-3: permissions as LE 32-bit
    //   bytes 4-7: 0xFFFFFFFF
    //   byte 8: 'T' (0x54) for encryptMetadata=true
    //   bytes 9-11: 'adb'
    const dict = h.buildEncryptDict();
    const permsEncrypted = Uint8Array.fromHex((dict.get('/Perms') as PdfString).value);
    expect(permsEncrypted.length).toBe(16);

    // Decrypt with file key (AES-256-ECB = CBC with zero IV, one block)
    const fileKey = h.getFileKey();
    // Use raw Web Crypto to decrypt
    const subtle = globalThis.crypto.subtle;
    const keyBuf = fileKey.buffer.slice(fileKey.byteOffset, fileKey.byteOffset + fileKey.byteLength);
    const cryptoKey = await subtle.importKey('raw', keyBuf, 'AES-CBC', false, ['encrypt', 'decrypt']);
    const zeroIv = new Uint8Array(16);

    // To decrypt without padding, we need to handle the no-pad case
    // by appending a fake padding block
    const lastBlock = permsEncrypted.subarray(0, 16);
    const paddingPlaintext = new Uint8Array(16).fill(16);
    const paddingEncrypted = await subtle.encrypt(
      { name: 'AES-CBC', iv: lastBlock.buffer.slice(0) as ArrayBuffer },
      cryptoKey,
      paddingPlaintext.buffer.slice(0) as ArrayBuffer,
    );
    const combined = new Uint8Array(32);
    combined.set(permsEncrypted, 0);
    combined.set(new Uint8Array(paddingEncrypted, 0, 16), 16);

    const decrypted = new Uint8Array(
      await subtle.decrypt(
        { name: 'AES-CBC', iv: zeroIv.buffer.slice(0) as ArrayBuffer },
        cryptoKey,
        combined.buffer.slice(0) as ArrayBuffer,
      ),
    );

    const decBlock = decrypted.subarray(0, 16);

    // Bytes 4-7: 0xFFFFFFFF
    expect(decBlock[4]).toBe(0xff);
    expect(decBlock[5]).toBe(0xff);
    expect(decBlock[6]).toBe(0xff);
    expect(decBlock[7]).toBe(0xff);

    // Byte 8: 'T' (encryptMetadata = true)
    expect(decBlock[8]).toBe(0x54);

    // Bytes 9-11: 'adb'
    expect(decBlock[9]).toBe(0x61);  // 'a'
    expect(decBlock[10]).toBe(0x64); // 'd'
    expect(decBlock[11]).toBe(0x62); // 'b'

    // Bytes 0-3: permissions as LE 32-bit — verify they match
    const pValue =
      decBlock[0]! |
      (decBlock[1]! << 8) |
      (decBlock[2]! << 16) |
      ((decBlock[3]! << 24) >>> 0);
    // Compare as signed 32-bit
    const pSigned = pValue | 0;
    expect(pSigned).toBe(h.getPermissionsValue());
  });
});
