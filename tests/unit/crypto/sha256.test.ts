/**
 * Tests for SHA-256/384/512 hashing via Web Crypto.
 *
 * Test vectors from:
 * - FIPS 180-4 / NIST CSRC examples
 * - RFC 6234
 */

import { describe, it, expect } from 'vitest';
import { sha256, sha384, sha512 } from '../../../src/crypto/sha256.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexFromBytes(bytes: Uint8Array): string {
  return bytes.toHex();
}

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// ---------------------------------------------------------------------------
// Tests: sha256
// ---------------------------------------------------------------------------

describe('sha256', () => {
  it('should hash empty input correctly (NIST)', async () => {
    const hash = await sha256(new Uint8Array(0));
    expect(hexFromBytes(hash)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('should hash "abc" correctly (NIST)', async () => {
    const hash = await sha256(stringToBytes('abc'));
    expect(hexFromBytes(hash)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('should hash "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq" correctly (NIST)', async () => {
    const hash = await sha256(
      stringToBytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    );
    expect(hexFromBytes(hash)).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('should hash "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu" correctly (NIST)', async () => {
    const hash = await sha256(
      stringToBytes(
        'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
      ),
    );
    expect(hexFromBytes(hash)).toBe(
      'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
    );
  });

  it('should always return exactly 32 bytes', async () => {
    const hash = await sha256(stringToBytes('test'));
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32);
  });

  it('should produce consistent hashes for the same input', async () => {
    const input = stringToBytes('deterministic input');
    const hash1 = hexFromBytes(await sha256(input));
    const hash2 = hexFromBytes(await sha256(input));
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    const hash1 = hexFromBytes(await sha256(stringToBytes('hello')));
    const hash2 = hexFromBytes(await sha256(stringToBytes('world')));
    expect(hash1).not.toBe(hash2);
  });

  it('should handle single-byte input', async () => {
    const hash = await sha256(new Uint8Array([0x61])); // 'a'
    expect(hexFromBytes(hash)).toBe(
      'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    );
  });

  it('should handle binary data with null bytes', async () => {
    const data = new Uint8Array([0x00, 0x00, 0x00]);
    const hash = await sha256(data);
    expect(hash.length).toBe(32);
    // Known SHA-256 of three zero bytes
    expect(hexFromBytes(hash)).toBe(
      '709e80c88487a2411e1ee4dfb9f22a861492d20c4765150c0c794abd70f8147c',
    );
  });

  it('should handle large input (10 KB)', async () => {
    const data = new Uint8Array(10240);
    for (let i = 0; i < data.length; i++) {
      data[i] = i & 0xff;
    }
    const hash = await sha256(data);
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32);
  });

  it('should handle input exactly 55 bytes (padding edge case)', async () => {
    const data = new Uint8Array(55);
    data.fill(0x41);
    const hash = await sha256(data);
    expect(hash.length).toBe(32);
  });

  it('should handle input exactly 56 bytes (padding edge case)', async () => {
    const data = new Uint8Array(56);
    data.fill(0x42);
    const hash = await sha256(data);
    expect(hash.length).toBe(32);
  });

  it('should handle input exactly 64 bytes (one full block)', async () => {
    const data = new Uint8Array(64);
    data.fill(0x43);
    const hash = await sha256(data);
    expect(hash.length).toBe(32);
  });

  it('should handle a Uint8Array subarray (non-zero byteOffset)', async () => {
    const buffer = new Uint8Array([0xff, 0x61, 0x62, 0x63, 0xff]); // 'abc' in the middle
    const sub = buffer.subarray(1, 4);
    const hash = await sha256(sub);
    // Should match sha256('abc')
    expect(hexFromBytes(hash)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: sha384
// ---------------------------------------------------------------------------

describe('sha384', () => {
  it('should hash empty input correctly (NIST)', async () => {
    const hash = await sha384(new Uint8Array(0));
    expect(hexFromBytes(hash)).toBe(
      '38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b',
    );
  });

  it('should hash "abc" correctly (NIST)', async () => {
    const hash = await sha384(stringToBytes('abc'));
    expect(hexFromBytes(hash)).toBe(
      'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
    );
  });

  it('should hash "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq" correctly (NIST)', async () => {
    const hash = await sha384(
      stringToBytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    );
    expect(hexFromBytes(hash)).toBe(
      '3391fdddfc8dc7393707a65b1b4709397cf8b1d162af05abfe8f450de5f36bc6b0455a8520bc4e6f5fe95b1fe3c8452b',
    );
  });

  it('should always return exactly 48 bytes', async () => {
    const hash = await sha384(stringToBytes('test'));
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(48);
  });

  it('should produce consistent hashes', async () => {
    const input = stringToBytes('deterministic');
    const hash1 = hexFromBytes(await sha384(input));
    const hash2 = hexFromBytes(await sha384(input));
    expect(hash1).toBe(hash2);
  });

  it('should handle large input (10 KB)', async () => {
    const data = new Uint8Array(10240);
    data.fill(0xab);
    const hash = await sha384(data);
    expect(hash.length).toBe(48);
  });
});

// ---------------------------------------------------------------------------
// Tests: sha512
// ---------------------------------------------------------------------------

describe('sha512', () => {
  it('should hash empty input correctly (NIST)', async () => {
    const hash = await sha512(new Uint8Array(0));
    expect(hexFromBytes(hash)).toBe(
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
    );
  });

  it('should hash "abc" correctly (NIST)', async () => {
    const hash = await sha512(stringToBytes('abc'));
    expect(hexFromBytes(hash)).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });

  it('should hash "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq" correctly (NIST)', async () => {
    const hash = await sha512(
      stringToBytes('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    );
    expect(hexFromBytes(hash)).toBe(
      '204a8fc6dda82f0a0ced7beb8e08a41657c16ef468b228a8279be331a703c33596fd15c13b1b07f9aa1d3bea57789ca031ad85c7a71dd70354ec631238ca3445',
    );
  });

  it('should always return exactly 64 bytes', async () => {
    const hash = await sha512(stringToBytes('test'));
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(64);
  });

  it('should produce consistent hashes', async () => {
    const input = stringToBytes('deterministic');
    const hash1 = hexFromBytes(await sha512(input));
    const hash2 = hexFromBytes(await sha512(input));
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes from sha256 and sha384', async () => {
    const input = stringToBytes('cross-algorithm test');
    const h256 = hexFromBytes(await sha256(input));
    const h384 = hexFromBytes(await sha384(input));
    const h512 = hexFromBytes(await sha512(input));
    expect(h256).not.toBe(h384);
    expect(h256).not.toBe(h512);
    expect(h384).not.toBe(h512);
  });

  it('should handle large input (10 KB)', async () => {
    const data = new Uint8Array(10240);
    data.fill(0xcd);
    const hash = await sha512(data);
    expect(hash.length).toBe(64);
  });

  it('should handle a Uint8Array subarray (non-zero byteOffset)', async () => {
    const buffer = new Uint8Array([0xff, 0x61, 0x62, 0x63, 0xff]);
    const sub = buffer.subarray(1, 4);
    const hash = await sha512(sub);
    // Should match sha512('abc')
    expect(hexFromBytes(hash)).toBe(
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
    );
  });
});
