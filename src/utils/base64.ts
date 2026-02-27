/**
 * @module utils/base64
 *
 * Base64 encoding and decoding utilities using native `Uint8Array` methods.
 *
 * These functions work in all modern JavaScript runtimes (Node 22+, Deno,
 * Bun, Cloudflare Workers, modern browsers) using the native
 * `Uint8Array.prototype.toBase64()` and `Uint8Array.fromBase64()` APIs.
 *
 * The implementation follows RFC 4648 (standard Base64 alphabet).
 */

/**
 * Encode a `Uint8Array` to a standard Base64 string.
 *
 * @param data  The bytes to encode.
 * @returns     A Base64-encoded string.
 */
export function base64Encode(data: Uint8Array): string {
  return data.toBase64();
}

/**
 * Decode a standard Base64 string to a `Uint8Array`.
 *
 * Whitespace characters (spaces, tabs, newlines) are stripped before
 * decoding. Trailing `=` padding is handled correctly.
 *
 * @param str     A Base64-encoded string.
 * @returns       The decoded bytes.
 * @throws        If the string contains invalid Base64 characters.
 */
export function base64Decode(str: string): Uint8Array {
  return Uint8Array.fromBase64(str.replace(/\s/g, ''));
}
