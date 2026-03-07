/**
 * @module signature/revocationCache
 *
 * Revocation response caching for OCSP and CRL data.
 *
 * Provides a time-bounded in-memory cache to avoid redundant network
 * requests when checking certificate revocation status.  Cache keys
 * are derived using FNV-1a hashing of certificate serial numbers and
 * issuer identifiers.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * OCSP revocation status result.
 */
export interface OcspResult {
  /** Certificate status. */
  status: 'good' | 'revoked' | 'unknown';
  /** When this status information was produced. */
  thisUpdate: Date;
  /** When next status update is expected. */
  nextUpdate?: Date | undefined;
  /** If revoked, the revocation date. */
  revokedAt?: Date | undefined;
  /** If revoked, the reason string. */
  revocationReason?: string | undefined;
}

/**
 * CRL revocation list data.
 */
export interface CrlData {
  /** CRL issuer distinguished name. */
  issuer: string;
  /** When this CRL was issued. */
  thisUpdate: Date;
  /** When the next CRL is expected. */
  nextUpdate?: Date | undefined;
  /** Revoked certificate entries. */
  entries: Array<{
    serialNumber: Uint8Array;
    revocationDate: Date;
    reason?: string | undefined;
  }>;
}

/**
 * Cached OCSP response entry.
 */
export interface OcspCacheEntry {
  /** The OCSP result. */
  result: OcspResult;
  /** Timestamp when this entry was cached (ms since epoch). */
  cachedAt: number;
  /** Timestamp when this entry expires (ms since epoch). */
  expiresAt: number;
}

/**
 * Cached CRL data entry.
 */
export interface CrlCacheEntry {
  /** The CRL data. */
  data: CrlData;
  /** Timestamp when this entry was cached (ms since epoch). */
  cachedAt: number;
  /** Timestamp when this entry expires (ms since epoch). */
  expiresAt: number;
}

/**
 * Configuration options for the revocation cache.
 */
export interface RevocationCacheOptions {
  /** Cache entry time-to-live in milliseconds. Default: 300000 (5 minutes). */
  ttlMs?: number | undefined;
  /** Maximum number of entries before eviction. Default: 1000. */
  maxEntries?: number | undefined;
}

// ---------------------------------------------------------------------------
// Internal: FNV-1a hash
// ---------------------------------------------------------------------------

/**
 * Compute an FNV-1a hash of a byte array and return it as a hex string.
 *
 * Uses the same algorithm as the image deduplication module for
 * consistency across the codebase.
 *
 * @param data  The bytes to hash.
 * @returns     8-character hex string.
 * @internal
 */
function fnv1aHash(data: Uint8Array): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i]!;
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Derive a cache key from a certificate serial number and issuer string.
 *
 * Concatenates the serial bytes and UTF-8-encoded issuer, then computes
 * an FNV-1a hash for a compact, fixed-length key.
 *
 * @param serial  Certificate serial number bytes.
 * @param issuer  Issuer distinguished name string.
 * @returns       A hex string cache key.
 */
export function deriveCacheKey(serial: Uint8Array, issuer: string): string {
  const encoder = new TextEncoder();
  const issuerBytes = encoder.encode(issuer);
  const combined = new Uint8Array(serial.length + issuerBytes.length);
  combined.set(serial, 0);
  combined.set(issuerBytes, serial.length);
  return fnv1aHash(combined);
}

// ---------------------------------------------------------------------------
// RevocationCache
// ---------------------------------------------------------------------------

/**
 * In-memory cache for OCSP and CRL revocation responses.
 *
 * Entries expire after a configurable TTL (default 5 minutes).  When
 * the cache exceeds `maxEntries`, the oldest entries are evicted.
 *
 * @example
 * ```ts
 * const cache = new RevocationCache({ ttlMs: 10 * 60 * 1000 }); // 10 min
 * cache.cacheOcsp('abc123', {
 *   result: { status: 'good', thisUpdate: new Date() },
 *   cachedAt: Date.now(),
 *   expiresAt: Date.now() + 600_000,
 * });
 * const entry = cache.getCachedOcsp('abc123');
 * ```
 */
export class RevocationCache {
  private readonly _ttlMs: number;
  private readonly _maxEntries: number;
  private readonly _ocspMap = new Map<string, OcspCacheEntry>();
  private readonly _crlMap = new Map<string, CrlCacheEntry>();

  /**
   * Create a new revocation cache.
   *
   * @param options  Cache configuration.
   */
  constructor(options?: RevocationCacheOptions) {
    this._ttlMs = options?.ttlMs ?? 300_000; // 5 minutes
    this._maxEntries = options?.maxEntries ?? 1000;
  }

  // -----------------------------------------------------------------------
  // OCSP cache
  // -----------------------------------------------------------------------

  /**
   * Retrieve a cached OCSP response by certificate identifier.
   *
   * Returns `null` if no entry exists or the entry has expired.
   *
   * @param certId  The cache key (typically from `deriveCacheKey`).
   * @returns       The cached entry, or `null`.
   */
  getCachedOcsp(certId: string): OcspCacheEntry | null {
    const entry = this._ocspMap.get(certId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this._ocspMap.delete(certId);
      return null;
    }

    return entry;
  }

  /**
   * Store an OCSP response in the cache.
   *
   * If `expiresAt` is not set on the entry, it will be computed from
   * the configured TTL.
   *
   * @param certId  The cache key.
   * @param entry   The OCSP cache entry to store.
   */
  cacheOcsp(certId: string, entry: OcspCacheEntry): void {
    // If the entry has no explicit expiration, use the configured TTL
    const storedEntry: OcspCacheEntry = {
      ...entry,
      expiresAt: entry.expiresAt || (entry.cachedAt + this._ttlMs),
    };

    this._ocspMap.set(certId, storedEntry);
    this._evictIfNeeded();
  }

  // -----------------------------------------------------------------------
  // CRL cache
  // -----------------------------------------------------------------------

  /**
   * Retrieve a cached CRL by URL.
   *
   * Returns `null` if no entry exists or the entry has expired.
   *
   * @param url  The CRL distribution point URL.
   * @returns    The cached entry, or `null`.
   */
  getCachedCrl(url: string): CrlCacheEntry | null {
    const entry = this._crlMap.get(url);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this._crlMap.delete(url);
      return null;
    }

    return entry;
  }

  /**
   * Store a CRL in the cache.
   *
   * If `expiresAt` is not set on the entry, it will be computed from
   * the configured TTL.
   *
   * @param url    The CRL distribution point URL.
   * @param entry  The CRL cache entry to store.
   */
  cacheCrl(url: string, entry: CrlCacheEntry): void {
    const storedEntry: CrlCacheEntry = {
      ...entry,
      expiresAt: entry.expiresAt || (entry.cachedAt + this._ttlMs),
    };

    this._crlMap.set(url, storedEntry);
    this._evictIfNeeded();
  }

  // -----------------------------------------------------------------------
  // Maintenance
  // -----------------------------------------------------------------------

  /**
   * Remove all expired entries from both OCSP and CRL caches.
   *
   * @returns  The number of entries removed.
   */
  clearExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this._ocspMap) {
      if (now > entry.expiresAt) {
        this._ocspMap.delete(key);
        removed++;
      }
    }

    for (const [key, entry] of this._crlMap) {
      if (now > entry.expiresAt) {
        this._crlMap.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Remove all entries from both caches.
   */
  clear(): void {
    this._ocspMap.clear();
    this._crlMap.clear();
  }

  /**
   * Total number of entries across both OCSP and CRL caches.
   */
  get size(): number {
    return this._ocspMap.size + this._crlMap.size;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Evict oldest entries when the total count exceeds `maxEntries`.
   *
   * Uses the `cachedAt` timestamp to determine eviction order.
   * @internal
   */
  private _evictIfNeeded(): void {
    const total = this._ocspMap.size + this._crlMap.size;
    if (total <= this._maxEntries) return;

    // Collect all entries with their type and key for sorting
    const entries: Array<{ type: 'ocsp' | 'crl'; key: string; cachedAt: number }> = [];

    for (const [key, entry] of this._ocspMap) {
      entries.push({ type: 'ocsp', key, cachedAt: entry.cachedAt });
    }
    for (const [key, entry] of this._crlMap) {
      entries.push({ type: 'crl', key, cachedAt: entry.cachedAt });
    }

    // Sort oldest first
    entries.sort((a, b) => a.cachedAt - b.cachedAt);

    // Remove oldest entries until we are at or below maxEntries
    const toRemove = total - this._maxEntries;
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const entry = entries[i]!;
      if (entry.type === 'ocsp') {
        this._ocspMap.delete(entry.key);
      } else {
        this._crlMap.delete(entry.key);
      }
    }
  }
}
