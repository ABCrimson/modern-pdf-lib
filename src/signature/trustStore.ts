/**
 * @module signature/trustStore
 *
 * Custom trust store for certificate chain validation.
 *
 * Provides a `TrustStore` class that manages a collection of trusted
 * root CA certificates. Certificates are keyed by a SHA-256 hash of
 * their DER-encoded subject Name, enabling fast issuer lookups.
 *
 * This is used for offline and custom trust validation workflows
 * where the default system trust store is unavailable (e.g. browsers,
 * Cloudflare Workers) or where a restricted set of CAs is required.
 *
 * @packageDocumentation
 */

import { sha256 } from '../crypto/sha256.js';
import {
  parseDerTlv,
  extractIssuerAndSerial,
} from './pkcs7.js';
import type { Asn1Node } from './pkcs7.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for creating a TrustStore.
 */
export interface TrustStoreOptions {
  /** Initial set of trusted root certificates (DER-encoded). */
  certificates?: Uint8Array[] | undefined;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the DER-encoded subject Name from a certificate.
 */
function extractSubjectDer(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1; // Skip version [0] EXPLICIT
  }

  // serialNumber (idx), signature (idx+1), issuer (idx+2),
  // validity (idx+3), subject (idx+4)
  const subjectNode = tbsCert.children[idx + 4]!;
  const subjectStart =
    subjectNode.offset +
    (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(subjectStart, subjectStart + subjectNode.totalLength);
}

/**
 * Extract the DER-encoded issuer Name from a certificate.
 */
function extractIssuerDer(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1;
  }

  const issuerNode = tbsCert.children[idx + 2]!;
  const issuerStart =
    issuerNode.offset +
    (tbsCert.data.byteOffset - certDer.byteOffset);
  return certDer.subarray(issuerStart, issuerStart + issuerNode.totalLength);
}

/**
 * Extract the serial number bytes (raw INTEGER data) from a certificate.
 */
function extractSerialBytes(certDer: Uint8Array): Uint8Array {
  const cert = parseDerTlv(certDer, 0);
  const tbsCert = cert.children[0]!;

  let idx = 0;
  if (tbsCert.children[0]!.tag === 0xa0) {
    idx = 1;
  }

  const serialNode = tbsCert.children[idx]!;
  return serialNode.data;
}

/**
 * Compute a hex string key from a SHA-256 hash of DER bytes.
 */
async function computeSubjectKey(subjectDer: Uint8Array): Promise<string> {
  const hash = await sha256(subjectDer);
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compare two byte arrays for equality.
 */
function compareBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Internal storage entry
// ---------------------------------------------------------------------------

interface StoredCert {
  /** The raw DER-encoded certificate. */
  der: Uint8Array;
  /** The raw serial number bytes. */
  serialBytes: Uint8Array;
  /** SHA-256 hex hash of the subject Name. */
  subjectKey: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * A custom trust store for managing trusted root CA certificates.
 *
 * Certificates are stored in a Map keyed by a SHA-256 hash of their
 * DER-encoded subject Name, enabling O(1) issuer lookups.
 *
 * @example
 * ```ts
 * import { TrustStore } from 'modern-pdf-lib';
 *
 * const store = new TrustStore();
 * store.addCertificate(rootCaDer);
 *
 * if (store.isTrusted(someCert)) {
 *   console.log('Certificate is a trusted root');
 * }
 *
 * const issuer = store.findIssuer(leafCert);
 * if (issuer) {
 *   console.log('Found issuer in trust store');
 * }
 * ```
 */
export class TrustStore {
  /**
   * Internal storage: subject-hash -> array of StoredCert.
   * Multiple certificates may share the same subject (e.g. re-issued CAs).
   */
  private readonly _certs = new Map<string, StoredCert[]>();

  /** Total number of certificates in the store. */
  private _size = 0;

  /**
   * Pending initialization promise (for constructor certificates).
   * Methods await this before operating on the store.
   */
  private _ready: Promise<void>;

  /**
   * Create a new TrustStore, optionally pre-populated with certificates.
   *
   * @param options  Optional configuration including initial certificates.
   */
  constructor(options?: TrustStoreOptions) {
    if (options?.certificates && options.certificates.length > 0) {
      this._ready = this._addMany(options.certificates);
    } else {
      this._ready = Promise.resolve();
    }
  }

  // -------------------------------------------------------------------------
  // Public methods
  // -------------------------------------------------------------------------

  /**
   * Add a trusted root certificate to the store.
   *
   * @param cert  DER-encoded X.509 certificate.
   */
  async addCertificate(cert: Uint8Array): Promise<void> {
    await this._ready;
    await this._addOne(cert);
  }

  /**
   * Add multiple trusted root certificates to the store.
   *
   * @param certs  Array of DER-encoded X.509 certificates.
   */
  async addCertificates(certs: Uint8Array[]): Promise<void> {
    await this._ready;
    await this._addMany(certs);
  }

  /**
   * Remove a certificate from the store by its serial number.
   *
   * @param serialNumber  The DER-encoded INTEGER serial number
   *                      (raw bytes, without ASN.1 tag/length).
   * @returns `true` if a certificate was removed.
   */
  async removeCertificate(serialNumber: Uint8Array): Promise<boolean> {
    await this._ready;

    for (const [key, entries] of this._certs) {
      const idx = entries.findIndex((e) =>
        compareBytes(e.serialBytes, serialNumber),
      );
      if (idx !== -1) {
        entries.splice(idx, 1);
        this._size--;
        if (entries.length === 0) {
          this._certs.delete(key);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a certificate is in the trust store (exact DER match).
   *
   * @param cert  DER-encoded X.509 certificate.
   * @returns `true` if the certificate is trusted.
   */
  async isTrusted(cert: Uint8Array): Promise<boolean> {
    await this._ready;

    const subjectDer = extractSubjectDer(cert);
    const key = await computeSubjectKey(subjectDer);
    const entries = this._certs.get(key);
    if (!entries) return false;

    return entries.some((e) => compareBytes(e.der, cert));
  }

  /**
   * Find the issuer certificate for the given certificate.
   *
   * Looks up the certificate's issuer Name in the store (by subject hash)
   * and returns the first matching trusted certificate, or `null` if
   * no issuer is found.
   *
   * @param cert  DER-encoded X.509 certificate whose issuer to find.
   * @returns     The DER-encoded issuer certificate, or `null`.
   */
  async findIssuer(cert: Uint8Array): Promise<Uint8Array | null> {
    await this._ready;

    const issuerDer = extractIssuerDer(cert);
    const key = await computeSubjectKey(issuerDer);
    const entries = this._certs.get(key);
    if (!entries || entries.length === 0) return null;

    // Return the first matching certificate
    return entries[0]!.der;
  }

  /**
   * Get all certificates in the trust store.
   *
   * @returns Array of DER-encoded X.509 certificates.
   */
  async getAllCertificates(): Promise<Uint8Array[]> {
    await this._ready;

    const result: Uint8Array[] = [];
    for (const entries of this._certs.values()) {
      for (const entry of entries) {
        result.push(entry.der);
      }
    }
    return result;
  }

  /**
   * The number of certificates in the trust store.
   */
  get size(): number {
    return this._size;
  }

  /**
   * Remove all certificates from the trust store.
   */
  async clear(): Promise<void> {
    await this._ready;
    this._certs.clear();
    this._size = 0;
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * Add a single certificate to the store.
   */
  private async _addOne(cert: Uint8Array): Promise<void> {
    const subjectDer = extractSubjectDer(cert);
    const key = await computeSubjectKey(subjectDer);
    const serialBytes = extractSerialBytes(cert);

    const entry: StoredCert = {
      der: cert,
      serialBytes,
      subjectKey: key,
    };

    const existing = this._certs.get(key);
    if (existing) {
      // Avoid duplicates
      if (existing.some((e) => compareBytes(e.der, cert))) return;
      existing.push(entry);
    } else {
      this._certs.set(key, [entry]);
    }
    this._size++;
  }

  /**
   * Add multiple certificates.
   */
  private async _addMany(certs: Uint8Array[]): Promise<void> {
    for (const cert of certs) {
      await this._addOne(cert);
    }
  }
}
