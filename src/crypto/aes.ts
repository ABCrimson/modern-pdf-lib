/**
 * @module crypto/aes
 *
 * AES-CBC encryption and decryption using the Web Crypto API.
 *
 * Supports AES-128 (16-byte key) and AES-256 (32-byte key) in CBC mode
 * with PKCS#7 padding.  The IV is handled as follows:
 *
 * - **Encryption**: If no IV is provided, a random 16-byte IV is
 *   generated.  The IV is prepended to the ciphertext output.
 * - **Decryption**: The first 16 bytes of the input are treated as the
 *   IV; the remainder is the ciphertext.
 *
 * Uses `globalThis.crypto.subtle` which is available in:
 * - Node.js 18+ (via the built-in Web Crypto API)
 * - All modern browsers
 * - Deno, Bun, Cloudflare Workers
 *
 * No pure-JS fallback is provided since Web Crypto is universal in all
 * supported runtimes.
 *
 * Reference: PDF spec SS7.6 (Encryption), AES-CBC mode per NIST SP 800-38A.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the Web Crypto subtle interface, throwing if unavailable.
 */
function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto API (crypto.subtle) is not available in this runtime. ' +
      'AES encryption requires Node.js 18+, a modern browser, Deno, or Bun.',
    );
  }
  return subtle;
}

/**
 * Ensure a Uint8Array backed by a plain ArrayBuffer (not SharedArrayBuffer)
 * so it satisfies the Web Crypto API's BufferSource requirement.
 */
function toBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
}

/**
 * Import a raw AES key for CBC mode.
 */
async function importKey(
  key: Uint8Array,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  if (key.length !== 16 && key.length !== 32) {
    throw new RangeError(
      `AES key must be 16 bytes (AES-128) or 32 bytes (AES-256), got ${key.length}`,
    );
  }
  return getSubtle().importKey('raw', toBuffer(key), 'AES-CBC', false, usages);
}

/**
 * Generate a random 16-byte initialization vector.
 */
function randomIv(): Uint8Array {
  const iv = new Uint8Array(16);
  globalThis.crypto.getRandomValues(iv);
  return iv;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt data using AES-CBC with PKCS#7 padding.
 *
 * The returned ciphertext has the 16-byte IV prepended:
 * `[IV (16 bytes)] [ciphertext (N bytes)]`
 *
 * Web Crypto's AES-CBC implementation automatically applies PKCS#7
 * padding during encryption and removes it during decryption.
 *
 * @param key   AES key: 16 bytes (AES-128) or 32 bytes (AES-256).
 * @param data  Plaintext data to encrypt.
 * @param iv    Optional 16-byte initialization vector.  If omitted, a
 *              random IV is generated.
 * @returns     IV + ciphertext as a single Uint8Array.
 */
export async function aesEncryptCBC(
  key: Uint8Array,
  data: Uint8Array,
  iv?: Uint8Array | undefined,
): Promise<Uint8Array> {
  const actualIv = iv ?? randomIv();
  if (actualIv.length !== 16) {
    throw new RangeError(`AES-CBC IV must be 16 bytes, got ${actualIv.length}`);
  }

  const cryptoKey = await importKey(key, ['encrypt']);

  // Web Crypto AES-CBC automatically applies PKCS#7 padding
  const encrypted = await getSubtle().encrypt(
    { name: 'AES-CBC', iv: toBuffer(actualIv) },
    cryptoKey,
    toBuffer(data),
  );

  // Prepend IV to ciphertext
  const ciphertext = new Uint8Array(encrypted);
  const result = new Uint8Array(16 + ciphertext.length);
  result.set(actualIv, 0);
  result.set(ciphertext, 16);
  return result;
}

/**
 * Decrypt data using AES-CBC with PKCS#7 padding.
 *
 * Expects the first 16 bytes to be the IV, followed by the ciphertext.
 *
 * @param key   AES key: 16 bytes (AES-128) or 32 bytes (AES-256).
 * @param data  IV (16 bytes) + ciphertext.
 * @returns     The decrypted plaintext.
 */
export async function aesDecryptCBC(
  key: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  if (data.length < 32) {
    throw new RangeError(
      'AES-CBC ciphertext must be at least 32 bytes (16-byte IV + 16-byte minimum block)',
    );
  }

  const iv = data.subarray(0, 16);
  const ciphertext = data.subarray(16);

  if (ciphertext.length % 16 !== 0) {
    throw new RangeError(
      `AES-CBC ciphertext length (${ciphertext.length}) must be a multiple of 16`,
    );
  }

  const cryptoKey = await importKey(key, ['decrypt']);

  // Web Crypto AES-CBC automatically removes PKCS#7 padding
  const decrypted = await getSubtle().decrypt(
    { name: 'AES-CBC', iv: toBuffer(iv) },
    cryptoKey,
    toBuffer(ciphertext),
  );

  return new Uint8Array(decrypted);
}
