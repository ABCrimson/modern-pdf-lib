import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectRuntime } from '../../src/wasm/loader.js';
import {
  createPdfResponse,
  handlePdfRequest,
  isCacheAvailable,
} from '../../src/browser/serviceWorker.js';

// ---------------------------------------------------------------------------
// Helpers — mock / restore Service Worker globals
// ---------------------------------------------------------------------------

/** Stash original globalThis properties so we can restore them. */
let originalServiceWorkerGlobalScope: unknown;
let originalSelf: unknown;
let originalProcess: unknown;
let hasSWGS: boolean;
let hasProcess: boolean;

function installServiceWorkerGlobals(): void {
  // Create a mock ServiceWorkerGlobalScope constructor
  class MockServiceWorkerGlobalScope {}

  originalServiceWorkerGlobalScope = (globalThis as Record<string, unknown>)['ServiceWorkerGlobalScope'];
  originalSelf = (globalThis as Record<string, unknown>)['self'];
  originalProcess = (globalThis as Record<string, unknown>)['process'];
  hasSWGS = 'ServiceWorkerGlobalScope' in globalThis;
  hasProcess = 'process' in globalThis;

  // Install mock
  (globalThis as Record<string, unknown>)['ServiceWorkerGlobalScope'] = MockServiceWorkerGlobalScope;
  // Make `self` an instance of the mock
  (globalThis as Record<string, unknown>)['self'] = Object.create(MockServiceWorkerGlobalScope.prototype);
  // Remove process to simulate a non-Node environment (real Service Workers
  // have no process.versions.node)
  delete (globalThis as Record<string, unknown>)['process'];
}

function removeServiceWorkerGlobals(): void {
  if (hasSWGS) {
    (globalThis as Record<string, unknown>)['ServiceWorkerGlobalScope'] = originalServiceWorkerGlobalScope;
  } else {
    delete (globalThis as Record<string, unknown>)['ServiceWorkerGlobalScope'];
  }
  // Restore self — in Node/Vitest `self` is typically `globalThis`
  if (originalSelf !== undefined) {
    (globalThis as Record<string, unknown>)['self'] = originalSelf;
  } else {
    // Do not delete self in Node; it equals globalThis
    (globalThis as Record<string, unknown>)['self'] = globalThis;
  }
  // Restore process
  if (hasProcess) {
    (globalThis as Record<string, unknown>)['process'] = originalProcess;
  }
}

// ---------------------------------------------------------------------------
// Tests — detectRuntime
// ---------------------------------------------------------------------------

describe('detectRuntime — Service Worker detection', () => {
  afterEach(() => {
    removeServiceWorkerGlobals();
  });

  it('returns "service-worker" when ServiceWorkerGlobalScope is present and self is an instance', () => {
    installServiceWorkerGlobals();
    expect(detectRuntime()).toBe('service-worker');
  });

  it('does not return "service-worker" when ServiceWorkerGlobalScope is absent', () => {
    // Default test environment (Node) — should not detect as SW
    const runtime = detectRuntime();
    expect(runtime).not.toBe('service-worker');
  });

  it('falls back to "node" (or another runtime) when not in a Service Worker context', () => {
    const runtime = detectRuntime();
    // In the Vitest/Node test runner we expect 'node'
    expect(runtime).toBe('node');
  });
});

// ---------------------------------------------------------------------------
// Tests — createPdfResponse
// ---------------------------------------------------------------------------

describe('createPdfResponse', () => {
  it('creates a Response with content-type application/pdf', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const res = createPdfResponse(bytes);

    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
  });

  it('sets content-length to the byte length', () => {
    const bytes = new Uint8Array(42);
    const res = createPdfResponse(bytes);
    expect(res.headers.get('content-length')).toBe('42');
  });

  it('omits content-disposition when no filename is given', () => {
    const res = createPdfResponse(new Uint8Array(0));
    expect(res.headers.get('content-disposition')).toBeNull();
  });

  it('sets content-disposition with the given filename', () => {
    const res = createPdfResponse(new Uint8Array(0), 'report.pdf');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="report.pdf"',
    );
  });

  it('body contains the original PDF bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const res = createPdfResponse(bytes);
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(bytes);
  });
});

// ---------------------------------------------------------------------------
// Tests — handlePdfRequest
// ---------------------------------------------------------------------------

describe('handlePdfRequest', () => {
  it('calls the handler and returns a Response with PDF content-type', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const handler = vi.fn().mockResolvedValue(pdfBytes);

    const req = new Request('https://example.com/generate');
    const res = await handlePdfRequest(req, handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');

    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(pdfBytes);
  });

  it('returns a 500 Response when the handler throws', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('boom'));

    const req = new Request('https://example.com/generate');
    const res = await handlePdfRequest(req, handler);

    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toContain('boom');
  });

  it('returns a 500 Response when handler throws a non-Error value', async () => {
    const handler = vi.fn().mockRejectedValue('string error');

    const req = new Request('https://example.com/generate');
    const res = await handlePdfRequest(req, handler);

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('string error');
  });
});

// ---------------------------------------------------------------------------
// Tests — isCacheAvailable
// ---------------------------------------------------------------------------

describe('isCacheAvailable', () => {
  it('returns a boolean', () => {
    const result = isCacheAvailable();
    expect(typeof result).toBe('boolean');
  });

  it('returns true when caches.open is a function', () => {
    // Node 18+ / Vitest may or may not have caches — mock it
    const origCaches = (globalThis as Record<string, unknown>)['caches'];
    (globalThis as Record<string, unknown>)['caches'] = { open: () => {} };
    try {
      expect(isCacheAvailable()).toBe(true);
    } finally {
      if (origCaches !== undefined) {
        (globalThis as Record<string, unknown>)['caches'] = origCaches;
      } else {
        delete (globalThis as Record<string, unknown>)['caches'];
      }
    }
  });

  it('returns false when caches is undefined', () => {
    const origCaches = (globalThis as Record<string, unknown>)['caches'];
    delete (globalThis as Record<string, unknown>)['caches'];
    try {
      expect(isCacheAvailable()).toBe(false);
    } finally {
      if (origCaches !== undefined) {
        (globalThis as Record<string, unknown>)['caches'] = origCaches;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — exports from browser entry point
// ---------------------------------------------------------------------------

describe('browser entry exports', () => {
  it('exports handlePdfRequest, createPdfResponse, and isCacheAvailable', async () => {
    const mod = await import('../../src/browser.js');
    expect(typeof mod.handlePdfRequest).toBe('function');
    expect(typeof mod.createPdfResponse).toBe('function');
    expect(typeof mod.isCacheAvailable).toBe('function');
  });
});
