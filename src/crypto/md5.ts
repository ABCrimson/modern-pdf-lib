/**
 * @module crypto/md5
 *
 * Pure-JavaScript MD5 hash implementation.
 *
 * Produces a 16-byte (128-bit) digest from arbitrary binary input.
 * Used in PDF encryption key derivation (Algorithm 2, per-object keys)
 * where MD5 is required by the spec.
 *
 * Operates exclusively on `Uint8Array` -- no Node.js `Buffer` or
 * `crypto` module dependency, so it runs in every JavaScript runtime.
 *
 * Reference: RFC 1321 (The MD5 Message-Digest Algorithm).
 */

// ---------------------------------------------------------------------------
// Per-round shift amounts
// ---------------------------------------------------------------------------

const S: readonly number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

// ---------------------------------------------------------------------------
// Pre-computed T table: floor(2^32 * abs(sin(i+1))) for i = 0..63
// ---------------------------------------------------------------------------

const T: readonly number[] = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Left-rotate a 32-bit integer. */
function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

/**
 * Read a 32-bit little-endian word from a byte array at the given offset.
 */
function readU32LE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset]!) |
      ((data[offset + 1]!) << 8) |
      ((data[offset + 2]!) << 16) |
      ((data[offset + 3]!) << 24)) >>> 0
  );
}

/**
 * Write a 32-bit little-endian word into a byte array at the given offset.
 */
function writeU32LE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = value & 0xff;
  data[offset + 1] = (value >>> 8) & 0xff;
  data[offset + 2] = (value >>> 16) & 0xff;
  data[offset + 3] = (value >>> 24) & 0xff;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the MD5 hash of the given data.
 *
 * @param data  Input bytes.
 * @returns     A 16-byte Uint8Array containing the MD5 digest.
 */
export function md5(data: Uint8Array): Uint8Array {
  // --- Padding ---
  // Message length in bits (as a 64-bit value, low 32 bits + high 32 bits)
  const bitLenLow = (data.length << 3) >>> 0;
  const bitLenHigh = (data.length >>> 29) >>> 0;

  // Pad to 56 mod 64, then append 8-byte length
  const padLen = ((55 - (data.length % 64)) + 64) % 64 + 1;
  const totalLen = data.length + padLen + 8;
  const padded = new Uint8Array(totalLen);
  padded.set(data);
  padded[data.length] = 0x80;
  // Length in bits as little-endian 64-bit
  writeU32LE(padded, totalLen - 8, bitLenLow);
  writeU32LE(padded, totalLen - 4, bitLenHigh);

  // --- Process blocks ---
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);

  for (let offset = 0; offset < totalLen; offset += 64) {
    // Load 16 words
    for (let j = 0; j < 16; j++) {
      M[j] = readU32LE(padded, offset + j * 4);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;

      if (i < 16) {
        F = ((B & C) | (~B & D)) >>> 0;
        g = i;
      } else if (i < 32) {
        F = ((D & B) | (~D & C)) >>> 0;
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = (B ^ C ^ D) >>> 0;
        g = (3 * i + 5) % 16;
      } else {
        F = (C ^ (B | ~D)) >>> 0;
        g = (7 * i) % 16;
      }

      const temp = D;
      D = C;
      C = B;
      B = (B + rotl(((A + F + T[i]! + M[g]!) >>> 0), S[i]!)) >>> 0;
      A = temp;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  // --- Output ---
  const result = new Uint8Array(16);
  writeU32LE(result, 0, a0);
  writeU32LE(result, 4, b0);
  writeU32LE(result, 8, c0);
  writeU32LE(result, 12, d0);

  return result;
}
