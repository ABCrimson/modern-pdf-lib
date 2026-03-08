/**
 * @module wasm/inlineWasm
 *
 * Provides runtime access to inline (base64-encoded) WASM module bytes.
 *
 * This module is the runtime companion to the build-time code generation
 * script `scripts/generate-inline-wasm.ts`. It imports the generated
 * constants from `inlineWasm.generated.ts` and exposes a single function,
 * {@link getInlineWasmBytes}, that decodes a module's base64 string into
 * a `Uint8Array` on demand.
 *
 * Design:
 * - The heavy lifting (reading WASM files, base64 encoding) happens at
 *   **build time** via the code generation script.
 * - At **runtime**, only a single base64 decode is needed per module,
 *   and the result is cached.
 * - This approach avoids shipping base64 strings in the default bundle.
 *   The generated file is only imported when inline WASM is needed
 *   (e.g., as a fallback when no WASM path is configured).
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
// Decoded bytes cache
// ---------------------------------------------------------------------------

/** Cache of decoded WASM bytes, keyed by module name. */
const decodedCache = new Map<string, Uint8Array>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the decoded WASM bytes for a given module name.
 *
 * On first call for a module, the base64 string from the generated file
 * is decoded into a `Uint8Array`. Subsequent calls return the cached
 * result.
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

  // 2. Return cached bytes if available
  const cached = decodedCache.get(name);
  if (cached) return cached;

  // 3. Lazy-load the generated module data
  //    The generated file is imported synchronously since it is a static
  //    TypeScript module. Tree shaking ensures only the used constants
  //    are included in the final bundle.
  let base64Data: string;
  try {
    // Dynamic access to avoid hard failure when the generated file
    // does not exist (e.g., in development before running the generator).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const generated = requireGenerated();
    const moduleData = generated.INLINE_WASM_MODULES[name];
    if (!moduleData) {
      throw new Error(
        `WASM module "${name}" is not available in the generated inline data. ` +
        `Run \`npm run generate:wasm-inline\` to regenerate.`,
      );
    }
    base64Data = moduleData;
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

  // 4. Decode base64 to Uint8Array
  const bytes = Uint8Array.fromBase64(base64Data);

  // 5. Cache and return
  decodedCache.set(name, bytes);
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
 * Clear the decoded bytes cache.
 *
 * Primarily useful for testing. Does not affect the generated constants.
 */
export function clearInlineWasmCache(): void {
  decodedCache.clear();
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
