/**
 * An independent port of ISO 32000-2 Algorithm 2.B (7.6.4.3.4, "Computing a hash", used by the
 * R6 security handler) on `node:crypto`. It imports nothing from src/, so tests can hold the
 * library's own algorithm2B to it. Its own correctness is pinned by an outside tool:
 * tests/oracle/aes.test.ts checks it against the /U and /O hashes of 256 empty documents qpdf
 * 12.4.2 encrypted under varied passwords (512 cases, tests/fixtures/pdf20-hash/cases.json, from
 * scripts/oracle/pdf20-hash-cases.ts) and of tests/fixtures/encrypted/aes-256-r6.pdf. The same
 * test file also holds it to three known answers with salt 0102030405060708; those answers are
 * not published values but this port's own output, and qpdf's hashes are the outside check.
 *
 * The steps, with the round count of step 3 as pdf.js (PDF20._hash) and qpdf implement it:
 * 1. K = SHA-256(password || salt || udata), where udata is the 48-byte /U string when the
 *    owner password is checked and empty otherwise.
 * 2. Each round: K1 = (password || K || udata) repeated 64 times; E = AES-128-CBC of K1 with the
 *    first 16 bytes of K as the key and the next 16 as the IV, no padding; the first 16 bytes of
 *    E read as one unsigned big-endian number, modulo 3, pick SHA-256 (0), SHA-384 (1) or
 *    SHA-512 (2), and the new K is that hash of E, kept whole (32, 48 or 64 bytes).
 * 3. After at least 64 rounds, stop once the last byte of E is not greater than the number of
 *    rounds run so far minus 32 (rounds counted from 1, as pdf.js and qpdf count them); otherwise
 *    run another round.
 * 4. The result is the first 32 bytes of K.
 */
import { createCipheriv, createHash } from 'node:crypto';

/** Algorithm 2.B: the 32-byte hash of `password` with an 8-byte `salt` (and `udata` for the owner). */
export function pdf20Hash(
  password: Uint8Array,
  salt: Uint8Array,
  udata: Uint8Array = new Uint8Array(0),
): Uint8Array {
  let k: Uint8Array = createHash('sha256').update(password).update(salt).update(udata).digest();
  for (let round = 0; ; round++) {
    const unit = new Uint8Array(password.length + k.length + udata.length);
    unit.set(password, 0);
    unit.set(k, password.length);
    unit.set(udata, password.length + k.length);
    const k1 = new Uint8Array(unit.length * 64);
    for (let i = 0; i < 64; i++) k1.set(unit, i * unit.length);
    const cipher = createCipheriv('aes-128-cbc', k.subarray(0, 16), k.subarray(16, 32));
    cipher.setAutoPadding(false);
    const head = cipher.update(k1);
    const tail = cipher.final();
    const e = new Uint8Array(head.length + tail.length);
    e.set(head, 0);
    e.set(tail, head.length);
    // A big-endian number modulo 3 equals the sum of its bytes modulo 3, because 256 % 3 === 1.
    const pick = e.subarray(0, 16).reduce((sum, byte) => sum + byte, 0) % 3;
    k = createHash(pick === 0 ? 'sha256' : pick === 1 ? 'sha384' : 'sha512')
      .update(e)
      .digest();
    const last = e.at(-1) ?? 0;
    // Rounds counted from 1 (pdf.js PDF20._hash, qpdf): after round n >= 64, stop when the last
    // byte of E <= n - 32. `round` counts from 0, so n is round + 1.
    if (round >= 63 && last <= round + 1 - 32) break;
  }
  return k.subarray(0, 32);
}

/** Lower-case hex of `bytes`. */
export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** The bytes of a hex string (whitespace ignored). */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(clean)) throw new Error(`not hex: ${hex}`);
  return Uint8Array.from(clean.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}
