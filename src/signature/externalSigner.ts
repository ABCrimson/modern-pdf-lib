/**
 * @module signature/externalSigner
 *
 * External (HSM / KMS / WebCrypto) deferred-hash signer abstraction.
 *
 * This module enables signing flows where the private key never leaves the
 * signing backend — a Hardware Security Module, a cloud Key Management
 * Service, or a WebCrypto key handle. The library computes the message
 * digest, hands that digest to an injected {@link ExternalSigner}, and
 * receives back the raw signature bytes plus the certificate chain.
 *
 * The library itself never sees, holds, or transmits the private key. The
 * {@link signDeferred} function is pure logic over an injected backend, so it
 * can be exercised in tests with a mock signer and no real HSM or network.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Signature algorithm advertised by an {@link ExternalSigner}.
 *
 * This describes the key/signature family used by the backend so callers can
 * select the appropriate certificate and packaging (e.g. PKCS#7 SignerInfo
 * algorithm identifiers) downstream.
 */
export type SignatureAlgorithm = 'RSA' | 'ECDSA' | 'Ed25519';

/**
 * A signing backend whose private key is held externally (HSM / KMS /
 * WebCrypto). Implementations receive only a message digest and return the
 * raw signature bytes; the private key never crosses this boundary.
 */
export interface ExternalSigner {
  /** The signature algorithm family this backend uses. */
  readonly algorithm: SignatureAlgorithm;
  /**
   * Sign a pre-computed message digest.
   *
   * @param digest - The hash of the data to be signed.
   * @returns The raw signature bytes produced by the backend.
   */
  sign(digest: Uint8Array): Promise<Uint8Array>;
  /**
   * Retrieve the certificate chain associated with the signing key.
   *
   * @returns The certificate chain, leaf-first, as DER-encoded byte arrays.
   */
  getCertificateChain(): Promise<Uint8Array[]>;
}

/**
 * Options controlling a {@link signDeferred} operation.
 */
export interface DeferredSignOptions {
  /**
   * The hash algorithm used to digest the data before signing.
   *
   * Defaults to `'SHA-256'` when omitted.
   */
  readonly hashAlgorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512' | undefined;
}

/**
 * The result of a {@link signDeferred} operation.
 */
export interface DeferredSignResult {
  /** The digest of the input data that was handed to the signer. */
  readonly digest: Uint8Array;
  /** The raw signature bytes returned by the external signer. */
  readonly signature: Uint8Array;
  /** The certificate chain returned by the external signer, leaf-first. */
  readonly certificateChain: Uint8Array[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Perform a deferred-hash signing operation against an external signer.
 *
 * The data is digested locally with {@link crypto.subtle.digest}; the
 * resulting digest is handed to {@link ExternalSigner.sign}, and the
 * certificate chain is collected from {@link ExternalSigner.getCertificateChain}.
 * The library never has access to the private key.
 *
 * @param data - The bytes to be signed.
 * @param signer - The external signing backend.
 * @param options - Optional configuration; see {@link DeferredSignOptions}.
 * @returns The digest, the raw signature, and the certificate chain.
 */
export async function signDeferred(
  data: Uint8Array,
  signer: ExternalSigner,
  options?: DeferredSignOptions,
): Promise<DeferredSignResult> {
  const hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' =
    options?.hashAlgorithm ?? 'SHA-256';

  const digestBuffer: ArrayBuffer = await crypto.subtle.digest(
    hashAlgorithm,
    data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer,
  );
  const digest: Uint8Array = new Uint8Array(digestBuffer);

  const signature: Uint8Array = await signer.sign(digest);
  const certificateChain: Uint8Array[] = await signer.getCertificateChain();

  return { digest, signature, certificateChain };
}
