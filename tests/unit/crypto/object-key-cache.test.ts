/**
 * The per-object key cache of PdfEncryptionHandler (V 1-4) and the seeded output of the R2, R3
 * and R4 write path.
 *
 * Algorithm 1 derives each object's key from the file key, the low 3 bytes of the object number
 * and the low 2 bytes of the generation number. The cache must return a key only for a pair with
 * the same input bytes: objects whose numbers differ by a multiple of 65,536 get different keys.
 * The tests use only the public handler API: two handlers built from one Encrypt dictionary share
 * the file key and start with empty object-key caches.
 */
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PdfEncryptionHandler } from '../../../src/crypto/encryptionHandler.js';
import type { EncryptAlgorithm } from '../../../src/crypto/encryptionHandler.js';

const FILE_ID = Uint8Array.fromHex('00112233445566778899aabbccddeeff');
const PLAIN = new TextEncoder().encode('BT /F1 12 Tf (object one) Tj ET');

/** Two handlers with the same file key and cold caches, opened from one Encrypt dictionary. */
async function twoHandlers(
  algorithm: EncryptAlgorithm,
): Promise<[PdfEncryptionHandler, PdfEncryptionHandler]> {
  const writer = await PdfEncryptionHandler.create(
    { userPassword: 'user', ownerPassword: 'owner', algorithm },
    FILE_ID,
  );
  const dict = writer.buildEncryptDict();
  return [
    await PdfEncryptionHandler.fromEncryptDict(dict, FILE_ID, 'user'),
    await PdfEncryptionHandler.fromEncryptDict(dict, FILE_ID, 'owner'),
  ];
}

describe('object-key cache', () => {
  test.for([
    ['rc4-128', 1, 65537],
    ['aes-128', 1, 65537],
    ['rc4-128', 0, 32768],
    ['aes-128', 0, 32768],
    ['rc4-128', 7, 7 + 3 * 65536],
  ] as const)(
    '%s: object %i decrypts after object %i was keyed first',
    async ([algorithm, first, other]) => {
      const [a, b] = await twoHandlers(algorithm);
      const ciphertext = await a.encryptObject(first, 0, PLAIN);
      // Key the other object first in the second handler, then read the first one.
      await b.encryptObject(other, 0, PLAIN);
      expect(await b.decryptObject(first, 0, ciphertext)).toEqual(PLAIN);
      // And the other way round: the other object's data does not decrypt under the first key.
      const otherCiphertext = await a.encryptObject(other, 0, PLAIN);
      const [, c] = await twoHandlers(algorithm);
      await c.encryptObject(first, 0, PLAIN);
      expect(await c.decryptObject(other, 0, otherCiphertext)).toEqual(PLAIN);
    },
  );

  test('object numbers 2^24 apart share a key, as Algorithm 1 uses three bytes', async () => {
    const [a, b] = await twoHandlers('rc4-128');
    const ciphertext = await a.encryptObject(5, 0, PLAIN);
    expect(await b.decryptObject(5 + 2 ** 24, 0, ciphertext)).toEqual(PLAIN);
  });
});

/**
 * A deterministic stand-in for crypto.getRandomValues: byte i of the whole stream is
 * (i * 151 + 7) mod 256.
 */
function seedRandom(): void {
  let counter = 0;
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(
    <T extends ArrayBufferView | null>(array: T): T => {
      if (array !== null) {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < bytes.length; i++) bytes[i] = (counter++ * 151 + 7) & 0xff;
      }
      return array;
    },
  );
}

const hex = (bytes: Uint8Array): string => bytes.toHex();

describe('seeded R2, R3 and R4 encryption output', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * SHA-256 over the /O and /U values and the encryption of PLAIN as objects (1, 0), (5, 0),
   * (40000, 0) and (70000, 2), with a fixed file ID and seeded randomness (the AES IVs).
   * Recorded from 0.40.8; the derivation of R2 to R4 keys is unchanged since.
   */
  const PINNED: Readonly<Record<string, string>> = {
    'rc4-40': 'd0db3e36139db50d0b930e8874e2052ab8e583b0d4975a74dd2e95c3fd42c9be',
    'rc4-128': '20e963d9738dd2ad771e06806aa26a30a3b6dc828b8cd050995c01a004a876f9',
    'aes-128': '6a38f4446696b2867a80698dfa6773c628d48b8b7aa8271239073fa5a53c105e',
  };

  test.for(['rc4-40', 'rc4-128', 'aes-128'] as const)('%s', async (algorithm) => {
    seedRandom();
    const handler = await PdfEncryptionHandler.create(
      { userPassword: 'user', ownerPassword: 'owner', algorithm },
      FILE_ID,
    );
    const dict = handler.buildEncryptDict();
    const digest = createHash('sha256');
    for (const key of ['/O', '/U']) {
      const value = dict.get(key);
      digest.update(value?.kind === 'string' ? value.toBytes().toHex() : 'missing');
    }
    for (const [obj, gen] of [
      [1, 0],
      [5, 0],
      [40000, 0],
      [70000, 2],
    ] as const) {
      digest.update(await handler.encryptObject(obj, gen, PLAIN));
    }
    expect(hex(digest.digest())).toBe(PINNED[algorithm]);
  });
});
