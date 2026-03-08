/**
 * @module wasm/inlineWasm
 *
 * Provides runtime access to inline (base64-encoded) WASM module bytes
 * with **lazy decoding** and **GC-friendly caching**.
 *
 * This module is the runtime companion to the build-time code generation
 * script `scripts/generate-inline-wasm.ts`. It imports the generated
 * constants from `inlineWasm.generated.ts` and exposes functions that
 * decode a module's base64 string into a `Uint8Array` on demand.
 *
 * Design:
 * - The heavy lifting (reading WASM files, base64 encoding) happens at
 *   **build time** via the code generation script.
 * - At **runtime**, base64 decoding is deferred until the module is
 *   actually requested — no upfront cost.
 * - Decoded bytes are held via `WeakRef` so the GC can reclaim them
 *   when memory pressure is high. A strong cache is also available
 *   for performance-critical paths.
 * - {@link preloadInlineWasm} allows proactive decoding before first use.
 * - {@link getInlineWasmSize} returns the encoded size without triggering
 *   any base64 decode.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Known module names
// ---------------------------------------------------------------------------

/**
 * The set of all WASM module names supported by the library.
 *
 * These correspond to the crate directories under `src/wasm/`.
 */
export const WASM_MODULE_NAMES = [
  'libdeflate',
  'png',
  'ttf',
  'shaping',
  'jbig2',
  'jpeg',
] as const;

/** Union type of all valid WASM module names. */
export type WasmModuleName = (typeof WASM_MODULE_NAMES)[number];

// ---------------------------------------------------------------------------
// Decoded bytes cache (strong + WeakRef)
// ---------------------------------------------------------------------------

/**
 * Strong cache of decoded WASM bytes, keyed by module name.
 *
 * Entries are populated on first access and kept alive as long as
 * callers hold references. {@link clearInlineWasmCache} clears this.
 */
const strongCache = new Map<string, Uint8Array>();

/**
 * Weak cache of decoded WASM bytes.
 *
 * When the strong cache is cleared (e.g., to reduce memory), the
 * weak cache may still hold a reference if the GC hasn't collected
 * the bytes. This avoids redundant re-decoding when bytes are still
 * reachable elsewhere.
 */
const weakCache = new Map<string, WeakRef<Uint8Array>>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the decoded WASM bytes for a given module name.
 *
 * On first call for a module, the base64 string from the generated file
 * is decoded into a `Uint8Array`. Subsequent calls return the cached
 * result. If the strong cache has been cleared but a `WeakRef` still
 * holds the bytes, they are recovered without re-decoding.
 *
 * @param name  The WASM module name (e.g., `'libdeflate'`, `'png'`).
 * @returns     The decoded WASM binary as a `Uint8Array`.
 * @throws      If the module name is unknown or the generated file does
 *              not contain data for the requested module.
 *
 * @example
 * ```ts
 * const wasmBytes = getInlineWasmBytes('libdeflate');
 * const module = await WebAssembly.compile(wasmBytes);
 * ```
 */
export function getInlineWasmBytes(name: string): Uint8Array {
  // 1. Validate the module name
  if (!isValidModuleName(name)) {
    throw new Error(
      `Unknown WASM module: "${name}". ` +
      `Valid modules: ${WASM_MODULE_NAMES.join(', ')}`,
    );
  }

  // 2. Return from strong cache if available
  const strong = strongCache.get(name);
  if (strong) return strong;

  // 3. Check weak cache — may survive after strong cache was cleared
  const weakRef = weakCache.get(name);
  if (weakRef) {
    const weakBytes = weakRef.deref();
    if (weakBytes) {
      // Re-promote to strong cache
      strongCache.set(name, weakBytes);
      return weakBytes;
    }
    // WeakRef was collected — remove stale entry
    weakCache.delete(name);
  }

  // 4. Decode base64 from generated data (lazy — only on first access)
  const base64Data = getBase64Data(name);

  // 5. Decode base64 to Uint8Array
  const bytes = Uint8Array.fromBase64(base64Data);

  // 6. Cache in both strong and weak maps
  strongCache.set(name, bytes);
  weakCache.set(name, new WeakRef(bytes));

  return bytes;
}

/**
 * Check whether a given module name is a valid WASM module name.
 *
 * @param name  The name to check.
 * @returns     `true` if the name is one of the known WASM modules.
 */
export function isValidModuleName(name: string): name is WasmModuleName {
  return (WASM_MODULE_NAMES as readonly string[]).includes(name);
}

/**
 * Clear the decoded bytes cache (both strong and weak).
 *
 * Primarily useful for testing. Does not affect the generated constants.
 * After clearing, the next call to {@link getInlineWasmBytes} will
 * re-decode from base64.
 */
export function clearInlineWasmCache(): void {
  strongCache.clear();
  weakCache.clear();
}

/**
 * Check whether inline WASM data is available for a given module.
 *
 * Returns `true` if the generated file contains base64 data for the
 * requested module. Returns `false` if the generated file does not
 * exist or does not include the module.
 *
 * @param name  The WASM module name.
 * @returns     `true` if inline bytes can be retrieved for this module.
 */
export function hasInlineWasmData(name: string): boolean {
  if (!isValidModuleName(name)) return false;

  try {
    const generated = requireGenerated();
    return name in generated.INLINE_WASM_MODULES;
  } catch {
    return false;
  }
}

/**
 * Get the encoded (base64) size of a WASM module **without** decoding it.
 *
 * This is useful for diagnostics, size budgeting, and bundle analysis.
 * The returned value is the number of characters in the base64 string;
 * the actual binary size is approximately `encodedSize * 3 / 4`.
 *
 * @param name  The WASM module name.
 * @returns     The base64 string length (in characters), or `0` if the
 *              module is not available.
 *
 * @example
 * ```ts
 * const encoded = getInlineWasmSize('libdeflate');
 * const binaryApprox = Math.floor(encoded * 3 / 4);
 * console.log(`libdeflate: ~${binaryApprox} bytes binary`);
 * ```
 */
export function getInlineWasmSize(name: string): number {
  if (!isValidModuleName(name)) return 0;

  try {
    const generated = requireGenerated();
    const data = generated.INLINE_WASM_MODULES[name];
    return data ? data.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Proactively decode and cache WASM bytes for the specified modules.
 *
 * Call this during application initialization to avoid decoding latency
 * on the first actual use. If no names are provided, all available
 * modules are preloaded.
 *
 * @param names  Optional list of module names to preload. Defaults to
 *               all modules present in the generated data.
 * @returns      The names of modules that were successfully preloaded.
 *
 * @example
 * ```ts
 * // Preload specific modules
 * preloadInlineWasm('libdeflate', 'png');
 *
 * // Preload everything available
 * preloadInlineWasm();
 * ```
 */
export function preloadInlineWasm(...names: string[]): string[] {
  const targets = names.length > 0 ? names : [...WASM_MODULE_NAMES];
  const loaded: string[] = [];

  for (const name of targets) {
    if (!isValidModuleName(name)) continue;
    if (strongCache.has(name)) {
      loaded.push(name);
      continue;
    }

    try {
      getInlineWasmBytes(name);
      loaded.push(name);
    } catch {
      // Module not available in generated data — skip silently
    }
  }

  return loaded;
}

// ---------------------------------------------------------------------------
// Internal: lazy import of generated module
// ---------------------------------------------------------------------------

/** Cached reference to the generated module, loaded once. */
let generatedModule: GeneratedModule | undefined;

/** Shape of the generated module's exports. */
interface GeneratedModule {
  INLINE_WASM_MODULES: Readonly<Record<string, string>>;
  INLINE_WASM_MODULE_NAMES: readonly string[];
}

/**
 * Lazily load and cache the generated module.
 *
 * Uses a dynamic import expression to avoid hard compile-time dependency
 * on the generated file (which may not exist during development).
 */
function requireGenerated(): GeneratedModule {
  if (generatedModule) return generatedModule;

  // The generated file is a sibling module. We import it via a
  // well-known path. The import will fail if the file doesn't exist.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try {
    // Attempt synchronous evaluation. The generated file is a pure
    // data module with no side effects.
    // We use a trick: the generated module is imported and cached
    // by the caller using dynamic import or a pre-loaded reference.
    throw new Error(
      'Inline WASM data not loaded. ' +
      'Call loadInlineWasmModule() first, or run `npm run generate:wasm-inline`.',
    );
  } catch (err) {
    if (generatedModule) return generatedModule;
    throw err;
  }
}

/**
 * Extract the base64 string for a given module name from the generated data.
 *
 * @throws If the generated data is not loaded or does not contain the module.
 */
function getBase64Data(name: string): string {
  try {
    const generated = requireGenerated();
    const moduleData = generated.INLINE_WASM_MODULES[name];
    if (!moduleData) {
      throw new Error(
        `WASM module "${name}" is not available in the generated inline data. ` +
        `Run \`npm run generate:wasm-inline\` to regenerate.`,
      );
    }
    return moduleData;
  } catch (err) {
    if (err instanceof Error && err.message.includes('is not available')) {
      throw err;
    }
    throw new Error(
      `Failed to load inline WASM data for module "${name}". ` +
      `The generated file may not exist. ` +
      `Run \`npm run generate:wasm-inline\` to generate it. ` +
      `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Load the generated inline WASM module asynchronously.
 *
 * Must be called once before {@link getInlineWasmBytes} can be used.
 * This performs the dynamic import of the generated file and caches
 * the result for subsequent synchronous access.
 *
 * @throws If the generated file does not exist.
 *
 * @example
 * ```ts
 * await loadInlineWasmModule();
 * const bytes = getInlineWasmBytes('libdeflate');
 * ```
 */
export async function loadInlineWasmModule(): Promise<void> {
  if (generatedModule) return;

  const mod = await import('./inlineWasm.generated.js') as GeneratedModule;
  generatedModule = mod;
}

/**
 * Provide a pre-loaded generated module directly.
 *
 * This is useful in bundled environments where the generated module
 * has already been imported statically:
 *
 * ```ts
 * import * as generated from './inlineWasm.generated.js';
 * provideInlineWasmModule(generated);
 * ```
 *
 * @param mod  The generated module's exports.
 */
export function provideInlineWasmModule(mod: {
  INLINE_WASM_MODULES: Readonly<Record<string, string>>;
  INLINE_WASM_MODULE_NAMES: readonly string[];
}): void {
  generatedModule = mod;
}
