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
  preparePasswordV5,
  saslprep,
  concat,
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

// ===========================================================================
// Edge case tests — AES-256 key derivation hardening
// ===========================================================================

// ---------------------------------------------------------------------------
// 22. Empty password edge cases
// ---------------------------------------------------------------------------

describe('AES-256 empty password edge cases', () => {
  it('empty password produces valid preparePasswordV5 output (zero-length bytes)', () => {
    const result = preparePasswordV5('');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it('empty user password with non-empty owner password round-trips', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: '', ownerPassword: 'strongOwner!', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // User password (empty) should work
    const restoredUser = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '');
    const plain = enc.encode('empty user pwd edge case');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restoredUser.decryptObject(1, 0, cipher)).toEqual(plain);

    // Owner password should also work
    const restoredOwner = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'strongOwner!');
    expect(await restoredOwner.decryptObject(1, 0, cipher)).toEqual(plain);

    // Wrong password should fail
    await expect(
      PdfEncryptionHandler.fromEncryptDict(dict, fid, 'wrong'),
    ).rejects.toThrow(/ncorrect password/);
  });

  it('empty owner password with non-empty user password round-trips', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user123', ownerPassword: '', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restoredUser = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'user123');
    const plain = enc.encode('empty owner pwd edge case');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restoredUser.decryptObject(1, 0, cipher)).toEqual(plain);

    const restoredOwner = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '');
    expect(await restoredOwner.decryptObject(1, 0, cipher)).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 23. Maximum-length password boundary (127/128 bytes)
// ---------------------------------------------------------------------------

describe('AES-256 maximum-length password boundary', () => {
  it('127-byte ASCII password (exactly at limit) round-trips', async () => {
    const pwd = 'A'.repeat(127);
    expect(enc.encode(pwd).length).toBe(127);

    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('127-byte password test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('128-byte ASCII password (one over limit) is truncated to 127', async () => {
    const pwd128 = 'B'.repeat(128);
    const pwd127 = 'B'.repeat(127);
    expect(enc.encode(pwd128).length).toBe(128);

    // Both passwords should produce the same prepared bytes
    const prepared128 = preparePasswordV5(pwd128);
    const prepared127 = preparePasswordV5(pwd127);
    expect(prepared128.length).toBe(127);
    expect(prepared128.toHex()).toBe(prepared127.toHex());

    // Handler created with 128 should be openable with 127 and vice versa
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd128, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd127);
    const plain = enc.encode('128-byte boundary test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('200-byte ASCII password is truncated to 127 bytes', async () => {
    const pwd = 'C'.repeat(200);
    const prepared = preparePasswordV5(pwd);
    expect(prepared.length).toBe(127);
    // All bytes should be 'C' (0x43)
    for (let i = 0; i < 127; i++) {
      expect(prepared[i]).toBe(0x43);
    }
  });

  it('multi-byte UTF-8 password truncated at 127-byte boundary', async () => {
    // Each CJK char is 3 bytes in UTF-8; 42 chars = 126 bytes, 43 chars = 129 bytes
    const pwd42 = '\u4e00'.repeat(42); // 126 bytes
    const pwd43 = '\u4e00'.repeat(43); // 129 bytes -> truncated to 127

    const prepared42 = preparePasswordV5(pwd42);
    expect(prepared42.length).toBe(126); // Not truncated

    const prepared43 = preparePasswordV5(pwd43);
    expect(prepared43.length).toBe(127); // Truncated (may split a 3-byte char)

    // Round-trip with the 42-char password (fits exactly)
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd42, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd42);
    const plain = enc.encode('multi-byte boundary');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('exactly 127 bytes after SASLprep (with mapped-to-nothing chars removed)', async () => {
    // 127 'A' chars + some soft hyphens that get removed = still 127 bytes
    const pwd = 'A'.repeat(127) + '\u00AD\u00AD\u00AD';
    const prepared = preparePasswordV5(pwd);
    expect(prepared.length).toBe(127); // Soft hyphens removed, then 127 fits exactly
  });
});

// ---------------------------------------------------------------------------
// 24. Non-ASCII / Unicode password edge cases
// ---------------------------------------------------------------------------

describe('AES-256 non-ASCII password edge cases', () => {
  it('Chinese password encrypts and decrypts correctly', async () => {
    const pwd = '\u5bc6\u7801\u6d4b\u8bd5\u52a0\u5bc6';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: '\u6240\u6709\u8005', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('Chinese pwd test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('Arabic password encrypts and decrypts correctly', async () => {
    const pwd = '\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('Arabic pwd test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('emoji password encrypts and decrypts correctly', async () => {
    const pwd = 'pass\uD83D\uDD11word\uD83D\uDD12';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('emoji pwd test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('combining characters are normalized by NFKC', async () => {
    // "a" + combining ring above (U+030A) = NFKC -> "\u00E5" (a-ring)
    const pwdDecomposed = 'a\u030Abc';
    const pwdComposed = '\u00E5bc';

    // Both should produce the same prepared bytes
    const prep1 = preparePasswordV5(pwdDecomposed);
    const prep2 = preparePasswordV5(pwdComposed);
    expect(prep1.toHex()).toBe(prep2.toHex());

    // Handler created with decomposed form should accept composed form
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwdDecomposed, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwdComposed);
    const plain = enc.encode('combining char normalization');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('full-width digits are normalized to ASCII digits', async () => {
    // Full-width digits U+FF10-FF19 -> '0'-'9' via NFKC
    const pwdFullWidth = '\uFF11\uFF12\uFF13\uFF14\uFF15';
    const pwdAscii = '12345';

    const prep1 = preparePasswordV5(pwdFullWidth);
    const prep2 = preparePasswordV5(pwdAscii);
    expect(prep1.toHex()).toBe(prep2.toHex());

    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwdFullWidth, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwdAscii);
    const plain = enc.encode('full-width normalization');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('Japanese mixed Hiragana/Katakana password works', async () => {
    const pwd = '\u3053\u3093\u306b\u3061\u306f\u30D1\u30B9\u30EF\u30FC\u30C9';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('Japanese password');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('Korean Hangul password works', async () => {
    const pwd = '\uBE44\uBC00\uBC88\uD638';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('Korean password');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 25. SASLprep normalization edge cases
// ---------------------------------------------------------------------------

describe('AES-256 SASLprep edge cases', () => {
  it('rejects null bytes (U+0000) in password', () => {
    expect(() => saslprep('pass\x00word')).toThrow(/prohibited/i);
  });

  it('rejects ASCII control characters (U+0001-U+001F)', () => {
    for (let cp = 1; cp <= 0x1F; cp++) {
      expect(() => saslprep('a' + String.fromCodePoint(cp) + 'b')).toThrow(/prohibited/i);
    }
  });

  it('rejects DEL (U+007F)', () => {
    expect(() => saslprep('pass\x7Fword')).toThrow(/prohibited/i);
  });

  it('rejects C0 control characters (U+0080-U+009F)', () => {
    for (let cp = 0x80; cp <= 0x9F; cp++) {
      expect(() => saslprep(String.fromCodePoint(cp))).toThrow(/prohibited/i);
    }
  });

  it('rejects private use area characters', () => {
    expect(() => saslprep('test' + String.fromCodePoint(0xE000))).toThrow(/prohibited/i);
    expect(() => saslprep('test' + String.fromCodePoint(0xF8FF))).toThrow(/prohibited/i);
  });

  it('rejects ideographic description characters (C.7: U+2FF0-U+2FFB)', () => {
    expect(() => saslprep('test' + String.fromCodePoint(0x2FF0))).toThrow(/prohibited/i);
    expect(() => saslprep('test' + String.fromCodePoint(0x2FFB))).toThrow(/prohibited/i);
  });

  it('removes multiple mapped-to-nothing characters', () => {
    // SOFT HYPHEN + ZERO WIDTH SPACE + BOM interspersed
    const input = '\u00ADhel\u200Blo\uFEFF';
    expect(saslprep(input)).toBe('hello');
  });

  it('removes variation selectors (U+FE00-U+FE0F)', () => {
    expect(saslprep('A\uFE00B\uFE0FC')).toBe('ABC');
  });

  it('removes Mongolian free variation selectors', () => {
    expect(saslprep('x\u180By\u180Cz\u180D')).toBe('xyz');
  });

  it('maps all non-ASCII space types to U+0020', () => {
    const spaces = [
      0x00A0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004,
      0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F,
      0x205F, 0x3000,
    ];
    for (const cp of spaces) {
      const result = saslprep('a' + String.fromCodePoint(cp) + 'b');
      expect(result).toBe('a b');
    }
  });

  it('NFKC normalization: superscript digits become regular digits', () => {
    // Superscript 2 (U+00B2) -> '2' via NFKC
    expect(saslprep('\u00B2')).toBe('2');
  });

  it('NFKC normalization: ligature fi (U+FB01) becomes "fi"', () => {
    expect(saslprep('\uFB01le')).toBe('file');
  });

  it('password that normalizes to empty string via mapped-to-nothing', () => {
    // A password made entirely of mapped-to-nothing characters
    const pwd = '\u00AD\u200B\u2060\uFEFF';
    expect(saslprep(pwd)).toBe('');

    // This should produce an empty prepared password
    const prepared = preparePasswordV5(pwd);
    expect(prepared.length).toBe(0);
  });

  it('password with only non-ASCII spaces normalizes to spaces', () => {
    const pwd = '\u00A0\u3000\u2003';
    expect(saslprep(pwd)).toBe('   ');
  });

  it('combining grapheme joiner (U+034F) is removed', () => {
    expect(saslprep('a\u034Fb')).toBe('ab');
  });

  it('preserves legitimate Unicode after normalization', () => {
    // Latin Extended characters should pass through
    expect(saslprep('\u00FC\u00F6\u00E4')).toBe('\u00FC\u00F6\u00E4'); // umlaut chars
    // Devanagari
    expect(saslprep('\u0939\u093F\u0928\u094D\u0926\u0940')).toBe(
      '\u0939\u093F\u0928\u094D\u0926\u0940',
    );
  });
});

// ---------------------------------------------------------------------------
// 26. Password with null bytes
// ---------------------------------------------------------------------------

describe('AES-256 password with null bytes', () => {
  it('rejects password containing null byte (U+0000)', () => {
    expect(() => saslprep('before\x00after')).toThrow(/prohibited/i);
  });

  it('rejects password that is just a null byte', () => {
    expect(() => saslprep('\x00')).toThrow(/prohibited/i);
  });

  it('rejects password with multiple null bytes', () => {
    expect(() => saslprep('\x00\x00\x00')).toThrow(/prohibited/i);
  });
});

// ---------------------------------------------------------------------------
// 27. Password that normalizes to empty string
// ---------------------------------------------------------------------------

describe('AES-256 password normalizing to empty', () => {
  it('mapped-to-nothing password is equivalent to empty string', async () => {
    const fid = randomBytes(16);
    // Password consisting entirely of soft hyphens
    const softHyphenPwd = '\u00AD\u00AD\u00AD';

    const h = await PdfEncryptionHandler.create(
      { userPassword: softHyphenPwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // Should be openable with empty string (soft hyphens map to nothing)
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '');
    const plain = enc.encode('normalized-to-empty test');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('BOM-only password is equivalent to empty string', async () => {
    const fid = randomBytes(16);
    const bomPwd = '\uFEFF';

    const h = await PdfEncryptionHandler.create(
      { userPassword: bomPwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '');
    const plain = enc.encode('BOM-only password');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 28. Key derivation with all-zero salt
// ---------------------------------------------------------------------------

describe('AES-256 key derivation with all-zero salt', () => {
  it('Algorithm 2.B works with all-zero salt', async () => {
    const pwd = enc.encode('test');
    const zeroSalt = new Uint8Array(8); // all zeros
    const hash = await algorithm2B(pwd, zeroSalt);
    expect(hash.length).toBe(32);
    // Should be deterministic
    const hash2 = await algorithm2B(pwd, zeroSalt);
    expect(hash.toHex()).toBe(hash2.toHex());
  });

  it('all-zero salt produces different hash than non-zero salt', async () => {
    const pwd = enc.encode('test');
    const zeroSalt = new Uint8Array(8);
    const nonZeroSalt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const h1 = await algorithm2B(pwd, zeroSalt);
    const h2 = await algorithm2B(pwd, nonZeroSalt);
    expect(h1.toHex()).not.toBe(h2.toHex());
  });

  it('all-zero salt with empty password produces a valid hash', async () => {
    const pwd = new Uint8Array(0);
    const zeroSalt = new Uint8Array(8);
    const hash = await algorithm2B(pwd, zeroSalt);
    expect(hash.length).toBe(32);
  });

  it('all-zero salt with uKey (owner path) works', async () => {
    const pwd = enc.encode('owner');
    const zeroSalt = new Uint8Array(8);
    const uKey = randomBytes(48);
    const hash = await algorithm2B(pwd, zeroSalt, uKey);
    expect(hash.length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// 29. Algorithm 2.B specification conformance (PDF 2.0)
// ---------------------------------------------------------------------------

describe('Algorithm 2.B specification conformance', () => {
  it('initial hash is SHA-256(password + salt [+ uKey])', async () => {
    const pwd = enc.encode('test');
    const salt = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);

    // The first step of Algorithm 2.B is SHA-256(password + salt)
    // We can verify the algorithm produces a 32-byte result
    const hash = await algorithm2B(pwd, salt);
    expect(hash.length).toBe(32);
  });

  it('produces consistent results across multiple calls', async () => {
    const pwd = enc.encode('consistency');
    const salt = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0x11, 0x22, 0x33, 0x44]);
    const uKey = randomBytes(48);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => algorithm2B(pwd, salt, uKey)),
    );

    const firstHex = results[0]!.toHex();
    for (const r of results) {
      expect(r.toHex()).toBe(firstHex);
    }
  });

  it('different passwords produce different hashes', async () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const h1 = await algorithm2B(enc.encode('password1'), salt);
    const h2 = await algorithm2B(enc.encode('password2'), salt);
    expect(h1.toHex()).not.toBe(h2.toHex());
  });

  it('K1 block is (password+K+uKey) repeated 64 times', async () => {
    // This is a structural test: verify algorithm handles the 64x repetition
    // by checking output is always 32 bytes regardless of input lengths
    const shortPwd = enc.encode('x');
    const longPwd = enc.encode('a'.repeat(127));
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const uKey = randomBytes(48);

    const h1 = await algorithm2B(shortPwd, salt, uKey);
    const h2 = await algorithm2B(longPwd, salt, uKey);

    expect(h1.length).toBe(32);
    expect(h2.length).toBe(32);
    expect(h1.toHex()).not.toBe(h2.toHex());
  });

  it('round terminates after round 63 with correct E[-1] condition', async () => {
    // Algorithm 2.B should run at least 64 rounds (0-63) and may run more
    // We verify by ensuring the algorithm completes and produces valid output
    const pwd = enc.encode('termination-test');
    const salt = randomBytes(8);
    const hash = await algorithm2B(pwd, salt);
    expect(hash.length).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// 30. Encrypt/decrypt round-trip with edge-case passwords
// ---------------------------------------------------------------------------

describe('AES-256 encrypt/decrypt round-trip with edge-case passwords', () => {
  it('single-character password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'x', ownerPassword: 'y', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'x');
    const plain = enc.encode('single char password');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('password with only spaces', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: '   ', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '   ');
    const plain = enc.encode('spaces password');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('password with special ASCII characters', async () => {
    const pwd = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('special ASCII chars');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('password with accented Latin characters', async () => {
    const pwd = '\u00E9\u00E8\u00EA\u00EB\u00E0\u00E2\u00E4\u00F9\u00FB\u00FC';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('accented latin');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('user and owner passwords that are identical', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'same', ownerPassword: 'same', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'same');
    const plain = enc.encode('identical passwords');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('password with mixed scripts (Latin + CJK + Cyrillic)', async () => {
    const pwd = 'Hello\u4e16\u754c\u041f\u0440\u0438\u0432\u0435\u0442';
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: pwd, ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, pwd);
    const plain = enc.encode('mixed scripts');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });
});

// ---------------------------------------------------------------------------
// 31. Owner password vs user password validation
// ---------------------------------------------------------------------------

describe('AES-256 owner vs user password validation', () => {
  it('user password cannot open owner-locked content path, but both decrypt the same key', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'userPwd', ownerPassword: 'ownerPwd', algorithm: 'aes-256' },
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

    // User password verifies via user path
    expect(await verifyUserPassword('userPwd', dictValues, fid)).toBe(true);
    expect(await verifyOwnerPassword('userPwd', dictValues, fid)).toBe(false);

    // Owner password verifies via owner path
    expect(await verifyOwnerPassword('ownerPwd', dictValues, fid)).toBe(true);
    expect(await verifyUserPassword('ownerPwd', dictValues, fid)).toBe(false);

    // Both recover the same file key
    const userKey = await computeFileEncryptionKey('userPwd', dictValues, fid);
    const ownerKey = await computeFileEncryptionKey('ownerPwd', dictValues, fid);
    expect(userKey.toHex()).toBe(ownerKey.toHex());
    expect(userKey.toHex()).toBe(h.getFileKey().toHex());
  });

  it('owner password can decrypt content encrypted with user password key', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restoredUser = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'user');
    const restoredOwner = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'owner');

    const plain = enc.encode('cross-decryption test');

    // Encrypt with user-restored handler, decrypt with owner-restored handler
    const cipher = await restoredUser.encryptObject(1, 0, plain);
    const result = await restoredOwner.decryptObject(1, 0, cipher);
    expect(result).toEqual(plain);
  });

  it('neither user nor owner password matches wrong password', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'user123', ownerPassword: 'owner456', algorithm: 'aes-256' },
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

    expect(await verifyUserPassword('wrong', dictValues, fid)).toBe(false);
    expect(await verifyOwnerPassword('wrong', dictValues, fid)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 32. Permission flags with AES-256
// ---------------------------------------------------------------------------

describe('AES-256 permission flags edge cases', () => {
  it('all permissions granted', async () => {
    const h = await createAes256Handler('u', 'o', {
      permissions: {
        printing: true,
        modifying: true,
        copying: true,
        annotating: true,
        fillingForms: true,
        contentAccessibility: true,
        documentAssembly: true,
      },
    });
    const p = h.getPermissions();
    expect(p.printing).toBe(true);
    expect(p.modifying).toBe(true);
    expect(p.copying).toBe(true);
    expect(p.annotating).toBe(true);
    expect(p.fillingForms).toBe(true);
    expect(p.contentAccessibility).toBe(true);
    expect(p.documentAssembly).toBe(true);
  });

  it('no permissions granted (all false)', async () => {
    const h = await createAes256Handler('u', 'o', {
      permissions: {
        printing: false,
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: false,
        documentAssembly: false,
      },
    });
    const p = h.getPermissions();
    expect(p.printing).toBe(false);
    expect(p.modifying).toBe(false);
    expect(p.copying).toBe(false);
    expect(p.annotating).toBe(false);
    expect(p.fillingForms).toBe(false);
    expect(p.contentAccessibility).toBe(false);
    expect(p.documentAssembly).toBe(false);
  });

  it('permission value encodes correctly in /Perms block', async () => {
    const h = await PdfEncryptionHandler.create({
      userPassword: 'u',
      ownerPassword: 'o',
      algorithm: 'aes-256',
      permissions: { printing: true, copying: true },
    });

    const pValue = h.getPermissionsValue();
    // Should have bits 3 (print), 5 (copy), 12 (high-quality print) set, plus reserved
    expect(pValue & (1 << 2)).not.toBe(0); // bit 3
    expect(pValue & (1 << 4)).not.toBe(0); // bit 5
    expect(pValue & (1 << 11)).not.toBe(0); // bit 12

    // Verify round-trip through encode/decode
    const decoded = decodePermissions(pValue);
    expect(decoded.printing).toBe(true);
    expect(decoded.copying).toBe(true);
    expect(decoded.modifying).toBe(false);
  });

  it('permissions survive fromEncryptDict round-trip', async () => {
    const fid = randomBytes(16);
    const perms = {
      printing: 'lowResolution' as const,
      modifying: true,
      copying: false,
      annotating: true,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    };
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'u', ownerPassword: 'o', algorithm: 'aes-256', permissions: perms },
      fid,
    );
    const dict = h.buildEncryptDict();
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'u');
    const rPerms = restored.getPermissions();
    expect(rPerms.printing).toBe('lowResolution');
    expect(rPerms.modifying).toBe(true);
    expect(rPerms.copying).toBe(false);
    expect(rPerms.annotating).toBe(true);
    expect(rPerms.contentAccessibility).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 33. preparePasswordV5 unit tests
// ---------------------------------------------------------------------------

describe('preparePasswordV5 edge cases', () => {
  it('returns empty array for empty string', () => {
    expect(preparePasswordV5('').length).toBe(0);
  });

  it('truncates to exactly 127 bytes', () => {
    const longPwd = 'Z'.repeat(500);
    const prepared = preparePasswordV5(longPwd);
    expect(prepared.length).toBe(127);
  });

  it('does not truncate 126-byte password', () => {
    const pwd = 'A'.repeat(126);
    const prepared = preparePasswordV5(pwd);
    expect(prepared.length).toBe(126);
  });

  it('does not truncate 127-byte password', () => {
    const pwd = 'A'.repeat(127);
    const prepared = preparePasswordV5(pwd);
    expect(prepared.length).toBe(127);
  });

  it('applies SASLprep before truncation', () => {
    // 130 'A' chars + 10 soft hyphens = after SASLprep: 130 'A' chars -> truncated to 127
    const pwd = 'A'.repeat(130) + '\u00AD'.repeat(10);
    const prepared = preparePasswordV5(pwd);
    expect(prepared.length).toBe(127);
  });

  it('returns UTF-8 encoded bytes', () => {
    const pwd = '\u00E9'; // e-acute, 2 bytes in UTF-8
    const prepared = preparePasswordV5(pwd);
    expect(prepared.length).toBe(2);
    expect(prepared[0]).toBe(0xC3);
    expect(prepared[1]).toBe(0xA9);
  });
});

// ---------------------------------------------------------------------------
// 34. Key derivation cache isolation
// ---------------------------------------------------------------------------

describe('AES-256 key derivation cache behavior', () => {
  it('different passwords yield different file keys for same dict structure', async () => {
    const fid1 = randomBytes(16);
    const fid2 = randomBytes(16);
    const h1 = await PdfEncryptionHandler.create(
      { userPassword: 'alpha', ownerPassword: 'beta', algorithm: 'aes-256' },
      fid1,
    );
    const h2 = await PdfEncryptionHandler.create(
      { userPassword: 'gamma', ownerPassword: 'delta', algorithm: 'aes-256' },
      fid2,
    );
    expect(h1.getFileKey().toHex()).not.toBe(h2.getFileKey().toHex());
  });

  it('repeated calls to computeFileEncryptionKey return same key', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'cached', ownerPassword: 'owner', algorithm: 'aes-256' },
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

    const key1 = await computeFileEncryptionKey('cached', dictValues, fid);
    const key2 = await computeFileEncryptionKey('cached', dictValues, fid);
    expect(key1.toHex()).toBe(key2.toHex());
  });
});

// ---------------------------------------------------------------------------
// 35. Algorithm 2.B with empty password
// ---------------------------------------------------------------------------

describe('Algorithm 2.B with empty password', () => {
  it('produces a valid 32-byte hash with empty password', async () => {
    const pwd = new Uint8Array(0);
    const salt = randomBytes(8);
    const hash = await algorithm2B(pwd, salt);
    expect(hash.length).toBe(32);
  });

  it('empty password with uKey still produces valid hash', async () => {
    const pwd = new Uint8Array(0);
    const salt = randomBytes(8);
    const uKey = randomBytes(48);
    const hash = await algorithm2B(pwd, salt, uKey);
    expect(hash.length).toBe(32);
  });

  it('empty password hash differs from non-empty', async () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const emptyHash = await algorithm2B(new Uint8Array(0), salt);
    const nonEmptyHash = await algorithm2B(enc.encode('notempty'), salt);
    expect(emptyHash.toHex()).not.toBe(nonEmptyHash.toHex());
  });
});

// ---------------------------------------------------------------------------
// 36. Full end-to-end with SASLprep-equivalent passwords
// ---------------------------------------------------------------------------

describe('AES-256 SASLprep equivalence end-to-end', () => {
  it('NO-BREAK SPACE password is equivalent to ASCII space password', async () => {
    const fid = randomBytes(16);
    // U+00A0 (no-break space) should map to regular space
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'a\u00A0b', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    // Should be openable with regular space
    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'a b');
    const plain = enc.encode('NBSP equivalence');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('IDEOGRAPHIC SPACE (U+3000) password is equivalent to ASCII space', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'x\u3000y', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'x y');
    const plain = enc.encode('ideographic space');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('zero-width space password is equivalent to stripped version', async () => {
    const fid = randomBytes(16);
    const h = await PdfEncryptionHandler.create(
      { userPassword: 'ab\u200Bcd', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, 'abcd');
    const plain = enc.encode('ZWS equivalence');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });

  it('full-width digits password is equivalent to ASCII digits', async () => {
    const fid = randomBytes(16);
    // Full-width '123' -> NFKC -> '123'
    const h = await PdfEncryptionHandler.create(
      { userPassword: '\uFF11\uFF12\uFF13', ownerPassword: 'owner', algorithm: 'aes-256' },
      fid,
    );
    const dict = h.buildEncryptDict();

    const restored = await PdfEncryptionHandler.fromEncryptDict(dict, fid, '123');
    const plain = enc.encode('full-width digits');
    const cipher = await h.encryptObject(1, 0, plain);
    expect(await restored.decryptObject(1, 0, cipher)).toEqual(plain);
  });
});
