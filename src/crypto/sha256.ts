/**
 * @module crypto/sha256
 *
 * SHA-256/384/512 hashing via the Web Crypto API.
 *
 * Uses `globalThis.crypto.subtle.digest(...)` which is available in
 * Node.js 18+, all modern browsers, Deno, Bun, and Cloudflare Workers.
 *
 * Reference: FIPS 180-4 (Secure Hash Standard).
 */

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

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
 * Get the Web Crypto subtle interface, throwing if unavailable.
 */
function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto API (crypto.subtle) is not available in this runtime. ' +
      'SHA hashing requires Node.js 18+, a modern browser, Deno, or Bun.',
    );
  }
  return subtle;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hash of the given data.
 *
 * @param data  Input bytes.
 * @returns     A 32-byte Uint8Array containing the SHA-256 digest.
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await getSubtle().digest('SHA-256', toBuffer(data));
  return new Uint8Array(digest);
}

/**
 * Compute the SHA-384 hash of the given data.
 *
 * @param data  Input bytes.
 * @returns     A 48-byte Uint8Array containing the SHA-384 digest.
 */
export async function sha384(data: Uint8Array): Promise<Uint8Array> {
  const digest = await getSubtle().digest('SHA-384', toBuffer(data));
  return new Uint8Array(digest);
}

/**
 * Compute the SHA-512 hash of the given data.
 *
 * @param data  Input bytes.
 * @returns     A 64-byte Uint8Array containing the SHA-512 digest.
 */
export async function sha512(data: Uint8Array): Promise<Uint8Array> {
  const digest = await getSubtle().digest('SHA-512', toBuffer(data));
  return new Uint8Array(digest);
}
