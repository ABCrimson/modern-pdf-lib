/**
 * @module runtime/detect
 *
 * Auto-detection of the current JavaScript runtime and lazy creation
 * of the corresponding {@link RuntimeAdapter}.
 *
 * Detection order:
 *
 * 1. **Cloudflare Workers** — `navigator.userAgent` contains
 *    `'Cloudflare-Workers'`.
 * 2. **Deno** — `globalThis.Deno` exists.
 * 3. **Bun** — `globalThis.Bun` exists.
 * 4. **Node.js** — `globalThis.process?.versions?.node` is set.
 * 5. **Browser** — fallback when `typeof window !== 'undefined'`
 *    or `typeof self !== 'undefined'`.
 *
 * The result is cached so repeated calls are free.
 */

import type { RuntimeAdapter } from './adapter.js';
import { BrowserRuntimeAdapter } from './browser.js';
import { DenoRuntimeAdapter } from './deno.js';
import { NodeRuntimeAdapter } from './node.js';
import { WorkerRuntimeAdapter } from './worker.js';

// ---------------------------------------------------------------------------
// Runtime enumeration
// ---------------------------------------------------------------------------

/**
 * Known JavaScript runtimes.
 */
export type RuntimeKind = 'browser' | 'node' | 'worker' | 'deno' | 'bun';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Cached detection result. */
let detectedRuntime: RuntimeKind | undefined;

/**
 * Detect the current JavaScript runtime.
 *
 * The result is cached after the first invocation so subsequent calls
 * are essentially free.
 *
 * @returns A {@link RuntimeKind} string identifying the runtime.
 */
export function detectRuntime(): RuntimeKind {
  if (detectedRuntime !== undefined) return detectedRuntime;

  detectedRuntime = detectRuntimeUncached();
  return detectedRuntime;
}

/**
 * Perform the actual detection (called once and cached).
 */
function detectRuntimeUncached(): RuntimeKind {
  // 1. Cloudflare Workers
  //    Workers expose a `navigator` global with a UA string that
  //    contains 'Cloudflare-Workers'.
  if (isCloudflareWorker()) return 'worker';

  // 2. Deno
  if (isDeno()) return 'deno';

  // 3. Bun
  if (isBun()) return 'bun';

  // 4. Node.js
  if (isNode()) return 'node';

  // 5. Browser (default fallback)
  return 'browser';
}

// ---------------------------------------------------------------------------
// Individual runtime checks
// ---------------------------------------------------------------------------

function isCloudflareWorker(): boolean {
  try {
    // In Workers, `navigator` is a global.  Its `userAgent` contains
    // the string 'Cloudflare-Workers'.
    if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
      if (navigator.userAgent.includes('Cloudflare-Workers')) {
        return true;
      }
    }
  } catch {
    // Ignore — `navigator` may throw in some restricted contexts.
  }
  return false;
}

function isDeno(): boolean {
  try {
    return (
      typeof (globalThis as Record<string, unknown>)['Deno'] !== 'undefined'
    );
  } catch {
    return false;
  }
}

function isBun(): boolean {
  try {
    return (
      typeof (globalThis as Record<string, unknown>)['Bun'] !== 'undefined'
    );
  } catch {
    return false;
  }
}

function isNode(): boolean {
  try {
    const proc = (globalThis as Record<string, unknown>)['process'] as
      | { versions?: { node?: string } }
      | undefined;
    return typeof proc?.versions?.node === 'string';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/** Cached adapter instance. */
let cachedAdapter: RuntimeAdapter | undefined;

/**
 * Create (and cache) a {@link RuntimeAdapter} for the auto-detected
 * runtime.
 *
 * For Node and Deno/Bun the adapter is shared across the process
 * lifetime.  For browsers and Workers it is similarly cached on the
 * module scope.
 *
 * @returns A {@link RuntimeAdapter} appropriate for the current
 *          environment.
 */
export function createRuntimeAdapter(): RuntimeAdapter {
  if (cachedAdapter !== undefined) return cachedAdapter;

  const kind = detectRuntime();

  switch (kind) {
    case 'node':
    case 'bun':
      // Bun is Node-compatible and can use the same adapter.
      cachedAdapter = new NodeRuntimeAdapter();
      break;

    case 'deno':
      // Use the dedicated Deno adapter which calls Deno.readFile /
      // Deno.writeFile natively for cleaner permission prompts and
      // avoids the Node compatibility layer overhead.
      cachedAdapter = new DenoRuntimeAdapter();
      break;

    case 'worker':
      cachedAdapter = new WorkerRuntimeAdapter();
      break;

    case 'browser':
    default:
      cachedAdapter = new BrowserRuntimeAdapter();
      break;
  }

  return cachedAdapter;
}

/**
 * Reset the cached detection and adapter.
 *
 * Primarily useful in test harnesses that need to simulate different
 * runtimes within the same process.
 *
 * @internal
 */
export function resetDetection(): void {
  detectedRuntime = undefined;
  cachedAdapter = undefined;
}
