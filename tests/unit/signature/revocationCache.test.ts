/**
 * Tests for the revocation response cache.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RevocationCache,
  deriveCacheKey,
} from '../../../src/signature/revocationCache.js';
import type {
  OcspCacheEntry,
  CrlCacheEntry,
  OcspResult,
  CrlData,
} from '../../../src/signature/revocationCache.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOcspResult(status: 'good' | 'revoked' | 'unknown' = 'good'): OcspResult {
  return {
    status,
    thisUpdate: new Date(Date.UTC(2026, 2, 1, 12, 0, 0)),
    nextUpdate: new Date(Date.UTC(2026, 2, 2, 12, 0, 0)),
  };
}

function makeOcspEntry(
  status: 'good' | 'revoked' | 'unknown' = 'good',
  cachedAt?: number,
  expiresAt?: number,
): OcspCacheEntry {
  const now = cachedAt ?? Date.now();
  return {
    result: makeOcspResult(status),
    cachedAt: now,
    expiresAt: expiresAt ?? (now + 300_000),
  };
}

function makeCrlData(): CrlData {
  return {
    issuer: 'Test CA',
    thisUpdate: new Date(Date.UTC(2026, 2, 1)),
    nextUpdate: new Date(Date.UTC(2026, 3, 1)),
    entries: [
      {
        serialNumber: new Uint8Array([0x01, 0x02, 0x03]),
        revocationDate: new Date(Date.UTC(2026, 1, 15)),
        reason: 'keyCompromise',
      },
    ],
  };
}

function makeCrlEntry(cachedAt?: number, expiresAt?: number): CrlCacheEntry {
  const now = cachedAt ?? Date.now();
  return {
    data: makeCrlData(),
    cachedAt: now,
    expiresAt: expiresAt ?? (now + 300_000),
  };
}

// ---------------------------------------------------------------------------
// Tests: deriveCacheKey
// ---------------------------------------------------------------------------

describe('deriveCacheKey', () => {
  it('should produce a hex string from serial and issuer', () => {
    const serial = new Uint8Array([0x01, 0x02, 0x03]);
    const key = deriveCacheKey(serial, 'Test CA');

    expect(typeof key).toBe('string');
    expect(key).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should produce consistent keys for the same input', () => {
    const serial = new Uint8Array([0xab, 0xcd, 0xef]);
    const key1 = deriveCacheKey(serial, 'My Issuer');
    const key2 = deriveCacheKey(serial, 'My Issuer');

    expect(key1).toBe(key2);
  });

  it('should produce different keys for different serials', () => {
    const serial1 = new Uint8Array([0x01]);
    const serial2 = new Uint8Array([0x02]);

    const key1 = deriveCacheKey(serial1, 'Same Issuer');
    const key2 = deriveCacheKey(serial2, 'Same Issuer');

    expect(key1).not.toBe(key2);
  });

  it('should produce different keys for different issuers', () => {
    const serial = new Uint8Array([0x01]);

    const key1 = deriveCacheKey(serial, 'Issuer A');
    const key2 = deriveCacheKey(serial, 'Issuer B');

    expect(key1).not.toBe(key2);
  });

  it('should handle empty serial number', () => {
    const key = deriveCacheKey(new Uint8Array(0), 'Test');
    expect(typeof key).toBe('string');
    expect(key.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Tests: RevocationCache — OCSP
// ---------------------------------------------------------------------------

describe('RevocationCache — OCSP', () => {
  let cache: RevocationCache;

  beforeEach(() => {
    cache = new RevocationCache();
  });

  it('should store and retrieve OCSP entries', () => {
    const entry = makeOcspEntry();
    cache.cacheOcsp('cert-1', entry);

    const retrieved = cache.getCachedOcsp('cert-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.result.status).toBe('good');
  });

  it('should return null for non-existent keys', () => {
    expect(cache.getCachedOcsp('does-not-exist')).toBeNull();
  });

  it('should return null for expired entries', () => {
    const pastTime = Date.now() - 600_000; // 10 minutes ago
    const entry = makeOcspEntry('good', pastTime, pastTime + 100); // expired 10 min ago

    cache.cacheOcsp('expired-cert', entry);
    expect(cache.getCachedOcsp('expired-cert')).toBeNull();
  });

  it('should use configured TTL when expiresAt is 0', () => {
    const cache2 = new RevocationCache({ ttlMs: 60_000 });
    const now = Date.now();
    const entry: OcspCacheEntry = {
      result: makeOcspResult(),
      cachedAt: now,
      expiresAt: 0, // should use TTL
    };

    cache2.cacheOcsp('cert-ttl', entry);
    const retrieved = cache2.getCachedOcsp('cert-ttl');

    expect(retrieved).not.toBeNull();
    expect(retrieved!.expiresAt).toBe(now + 60_000);
  });

  it('should store revoked status', () => {
    const entry = makeOcspEntry('revoked');
    cache.cacheOcsp('revoked-cert', entry);

    const retrieved = cache.getCachedOcsp('revoked-cert');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.result.status).toBe('revoked');
  });

  it('should store unknown status', () => {
    const entry = makeOcspEntry('unknown');
    cache.cacheOcsp('unknown-cert', entry);

    const retrieved = cache.getCachedOcsp('unknown-cert');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.result.status).toBe('unknown');
  });

  it('should overwrite existing entries', () => {
    cache.cacheOcsp('cert-1', makeOcspEntry('good'));
    cache.cacheOcsp('cert-1', makeOcspEntry('revoked'));

    const retrieved = cache.getCachedOcsp('cert-1');
    expect(retrieved!.result.status).toBe('revoked');
  });
});

// ---------------------------------------------------------------------------
// Tests: RevocationCache — CRL
// ---------------------------------------------------------------------------

describe('RevocationCache — CRL', () => {
  let cache: RevocationCache;

  beforeEach(() => {
    cache = new RevocationCache();
  });

  it('should store and retrieve CRL entries', () => {
    const entry = makeCrlEntry();
    cache.cacheCrl('http://example.com/crl.der', entry);

    const retrieved = cache.getCachedCrl('http://example.com/crl.der');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.data.issuer).toBe('Test CA');
    expect(retrieved!.data.entries).toHaveLength(1);
  });

  it('should return null for non-existent URLs', () => {
    expect(cache.getCachedCrl('http://no-such-url.com/crl')).toBeNull();
  });

  it('should return null for expired CRL entries', () => {
    const pastTime = Date.now() - 600_000;
    const entry = makeCrlEntry(pastTime, pastTime + 100);

    cache.cacheCrl('http://example.com/old-crl.der', entry);
    expect(cache.getCachedCrl('http://example.com/old-crl.der')).toBeNull();
  });

  it('should use configured TTL when expiresAt is 0', () => {
    const cache2 = new RevocationCache({ ttlMs: 120_000 });
    const now = Date.now();
    const entry: CrlCacheEntry = {
      data: makeCrlData(),
      cachedAt: now,
      expiresAt: 0,
    };

    cache2.cacheCrl('http://example.com/crl', entry);
    const retrieved = cache2.getCachedCrl('http://example.com/crl');

    expect(retrieved).not.toBeNull();
    expect(retrieved!.expiresAt).toBe(now + 120_000);
  });
});

// ---------------------------------------------------------------------------
// Tests: RevocationCache — maintenance
// ---------------------------------------------------------------------------

describe('RevocationCache — maintenance', () => {
  it('should report correct size', () => {
    const cache = new RevocationCache();

    expect(cache.size).toBe(0);

    cache.cacheOcsp('cert-1', makeOcspEntry());
    expect(cache.size).toBe(1);

    cache.cacheCrl('http://example.com/crl', makeCrlEntry());
    expect(cache.size).toBe(2);
  });

  it('should clear all entries', () => {
    const cache = new RevocationCache();

    cache.cacheOcsp('cert-1', makeOcspEntry());
    cache.cacheOcsp('cert-2', makeOcspEntry());
    cache.cacheCrl('http://crl1', makeCrlEntry());

    expect(cache.size).toBe(3);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.getCachedOcsp('cert-1')).toBeNull();
    expect(cache.getCachedCrl('http://crl1')).toBeNull();
  });

  it('should clear expired entries', () => {
    const cache = new RevocationCache();
    const pastTime = Date.now() - 600_000;

    // Add one expired and one fresh entry
    cache.cacheOcsp('expired', makeOcspEntry('good', pastTime, pastTime + 100));
    cache.cacheOcsp('fresh', makeOcspEntry());

    const removed = cache.clearExpired();
    expect(removed).toBe(1);
    expect(cache.size).toBe(1);
    expect(cache.getCachedOcsp('fresh')).not.toBeNull();
  });

  it('should evict oldest entries when maxEntries is exceeded', () => {
    const cache = new RevocationCache({ maxEntries: 3 });
    const baseTime = Date.now();

    // Add 3 entries (at capacity)
    cache.cacheOcsp('old', makeOcspEntry('good', baseTime - 3000, baseTime + 300_000));
    cache.cacheOcsp('mid', makeOcspEntry('good', baseTime - 2000, baseTime + 300_000));
    cache.cacheOcsp('new', makeOcspEntry('good', baseTime - 1000, baseTime + 300_000));

    expect(cache.size).toBe(3);

    // Add a 4th entry — should evict 'old'
    cache.cacheOcsp('newest', makeOcspEntry('good', baseTime, baseTime + 300_000));

    expect(cache.size).toBe(3);
    expect(cache.getCachedOcsp('old')).toBeNull();
    expect(cache.getCachedOcsp('mid')).not.toBeNull();
    expect(cache.getCachedOcsp('new')).not.toBeNull();
    expect(cache.getCachedOcsp('newest')).not.toBeNull();
  });

  it('should evict across both OCSP and CRL maps', () => {
    const cache = new RevocationCache({ maxEntries: 2 });
    const baseTime = Date.now();

    cache.cacheOcsp('ocsp-old', makeOcspEntry('good', baseTime - 2000, baseTime + 300_000));
    cache.cacheCrl('crl-old', makeCrlEntry(baseTime - 1000, baseTime + 300_000));

    // Adding a third should evict the oldest (ocsp-old)
    cache.cacheOcsp('ocsp-new', makeOcspEntry('good', baseTime, baseTime + 300_000));

    expect(cache.size).toBe(2);
    expect(cache.getCachedOcsp('ocsp-old')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: RevocationCache — default TTL
// ---------------------------------------------------------------------------

describe('RevocationCache — default TTL', () => {
  it('should default to 5 minute TTL', () => {
    const cache = new RevocationCache();
    const now = Date.now();
    const entry: OcspCacheEntry = {
      result: makeOcspResult(),
      cachedAt: now,
      expiresAt: 0,
    };

    cache.cacheOcsp('test', entry);
    const retrieved = cache.getCachedOcsp('test');

    expect(retrieved).not.toBeNull();
    // Should be 5 minutes from cachedAt
    expect(retrieved!.expiresAt).toBe(now + 300_000);
  });

  it('should default to 1000 maxEntries', () => {
    const cache = new RevocationCache();
    const now = Date.now();

    // Add 1001 entries — only last 1000 should remain
    for (let i = 0; i <= 1000; i++) {
      cache.cacheOcsp(`cert-${i}`, makeOcspEntry('good', now + i, now + i + 300_000));
    }

    expect(cache.size).toBe(1000);
    // The oldest (cert-0) should have been evicted
    expect(cache.getCachedOcsp('cert-0')).toBeNull();
    expect(cache.getCachedOcsp('cert-1000')).not.toBeNull();
  });
});
