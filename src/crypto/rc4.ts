/**
 * @module crypto/rc4
 *
 * Pure-JavaScript RC4 (Rivest Cipher 4) implementation.
 *
 * RC4 is a symmetric stream cipher: the same function encrypts and
 * decrypts.  It is required for legacy PDF encryption (V=1 R=2 with
 * 40-bit keys, V=2 R=3 with 128-bit keys).
 *
 * Operates exclusively on `Uint8Array` -- no Node.js dependencies.
 *
 * Note: RC4 is considered cryptographically weak.  It is implemented
 * here solely for backward compatibility with older PDF files.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt or decrypt data using the RC4 stream cipher.
 *
 * RC4 is symmetric: `rc4(key, rc4(key, data))` returns the original data.
 *
 * @param key   The encryption key (1-256 bytes).
 * @param data  The data to encrypt or decrypt.
 * @returns     The transformed data (same length as input).
 */
export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const keyLen = key.length;
  if (keyLen === 0 || keyLen > 256) {
    throw new RangeError('RC4 key length must be 1-256 bytes');
  }

  // --- Key Scheduling Algorithm (KSA) ---
  const state = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    state[i] = i;
  }

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + state[i]! + key[i % keyLen]!) & 0xff;
    // Swap state[i] and state[j]
    const tmp = state[i]!;
    state[i] = state[j]!;
    state[j] = tmp;
  }

  // --- Pseudo-Random Generation Algorithm (PRGA) + XOR ---
  const result = new Uint8Array(data.length);
  let si = 0;
  let sj = 0;

  for (let k = 0; k < data.length; k++) {
    si = (si + 1) & 0xff;
    sj = (sj + state[si]!) & 0xff;

    // Swap state[si] and state[sj]
    const tmp = state[si]!;
    state[si] = state[sj]!;
    state[sj] = tmp;

    const keystreamByte = state[(state[si]! + state[sj]!) & 0xff]!;
    result[k] = data[k]! ^ keystreamByte;
  }

  return result;
}
