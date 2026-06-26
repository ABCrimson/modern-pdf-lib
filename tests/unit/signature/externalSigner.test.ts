/**
 * Tests for the external (HSM / KMS / WebCrypto) deferred-hash signer.
 *
 * The private key never leaves the injected backend. These tests use a mock
 * {@link ExternalSigner} whose `sign()` returns a known buffer, so no real
 * HSM or network is involved.
 */

import { describe, it, expect } from 'vitest';
import { signDeferred } from '../../../src/signature/externalSigner.js';
import type {
  ExternalSigner,
  SignatureAlgorithm,
  DeferredSignResult,
} from '../../../src/signature/externalSigner.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/** A fixed signature payload the mock backend returns from `sign()`. */
const KNOWN_SIGNATURE = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);

/** Two fixed DER-ish blobs standing in for a leaf + intermediate chain. */
const LEAF_CERT = new Uint8Array([0x30, 0x82, 0x01, 0x0a]);
const INTERMEDIATE_CERT = new Uint8Array([0x30, 0x82, 0x02, 0x0b]);

/**
 * Build a mock external signer that records the digest it was asked to sign.
 */
function createMockSigner(
  algorithm: SignatureAlgorithm = 'RSA',
): {
  signer: ExternalSigner;
  seenDigests: Uint8Array[];
} {
  const seenDigests: Uint8Array[] = [];
  const signer: ExternalSigner = {
    algorithm,
    async sign(digest: Uint8Array): Promise<Uint8Array> {
      seenDigests.push(digest);
      return KNOWN_SIGNATURE;
    },
    async getCertificateChain(): Promise<Uint8Array[]> {
      return [LEAF_CERT, INTERMEDIATE_CERT];
    },
  };
  return { signer, seenDigests };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('signDeferred', () => {
  it('returns the SHA-256 digest (32 bytes), signature, and chain', async () => {
    const data = encoder.encode('hello deferred signing');
    const { signer, seenDigests } = createMockSigner('RSA');

    const result: DeferredSignResult = await signDeferred(data, signer);

    // SHA-256 digest is 32 bytes.
    expect(result.digest.length).toBe(32);

    // The exact same digest is what the signer was handed.
    const seen = seenDigests.at(0);
    if (seen === undefined) {
      throw new Error('expected signer.sign() to have been called');
    }
    expect(Array.from(seen)).toStrictEqual(Array.from(result.digest));

    // The signer's signature bytes are passed through verbatim.
    expect(Array.from(result.signature)).toStrictEqual(
      Array.from(KNOWN_SIGNATURE),
    );

    // The certificate chain is returned leaf-first.
    expect(result.certificateChain.length).toBe(2);
    const leaf = result.certificateChain.at(0);
    const intermediate = result.certificateChain.at(1);
    if (leaf === undefined || intermediate === undefined) {
      throw new Error('expected a two-element certificate chain');
    }
    expect(Array.from(leaf)).toStrictEqual(Array.from(LEAF_CERT));
    expect(Array.from(intermediate)).toStrictEqual(
      Array.from(INTERMEDIATE_CERT),
    );
  });

  it('produces a known SHA-256 digest for known input', async () => {
    // SHA-256 of the empty string.
    const { signer } = createMockSigner();
    const result = await signDeferred(new Uint8Array(0), signer);

    const hex = Array.from(result.digest)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(hex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('uses SHA-512 when requested, yielding a 64-byte digest', async () => {
    const data = encoder.encode('hello deferred signing');
    const { signer } = createMockSigner('ECDSA');

    const result = await signDeferred(data, signer, {
      hashAlgorithm: 'SHA-512',
    });

    expect(result.digest.length).toBe(64);
  });

  it('uses SHA-384 when requested, yielding a 48-byte digest', async () => {
    const data = encoder.encode('hello deferred signing');
    const { signer } = createMockSigner('Ed25519');

    const result = await signDeferred(data, signer, {
      hashAlgorithm: 'SHA-384',
    });

    expect(result.digest.length).toBe(48);
  });

  it('defaults to SHA-256 when hashAlgorithm is explicitly undefined', async () => {
    const data = encoder.encode('payload');
    const { signer } = createMockSigner();

    const result = await signDeferred(data, signer, {
      hashAlgorithm: undefined,
    });

    expect(result.digest.length).toBe(32);
  });

  it('produces different digest lengths for different hash algorithms', async () => {
    const data = encoder.encode('same input bytes');
    const { signer } = createMockSigner();

    const sha256 = await signDeferred(data, signer, {
      hashAlgorithm: 'SHA-256',
    });
    const sha512 = await signDeferred(data, signer, {
      hashAlgorithm: 'SHA-512',
    });

    expect(sha256.digest.length).toBe(32);
    expect(sha512.digest.length).toBe(64);
    expect(sha256.digest.length).not.toBe(sha512.digest.length);
  });
});
