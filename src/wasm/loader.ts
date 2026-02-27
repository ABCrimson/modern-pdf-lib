/**
 * @module wasm/loader
 *
 * Universal WASM module loader for the modern-pdf library.
 *
 * Provides a single entry point for loading `.wasm` binaries across
 * all supported JavaScript runtimes:
 *
 * - **Browser**: Uses `fetch()` to load from a URL.
 * - **Node.js**: Uses `fs/promises` via dynamic import to read from disk.
 * - **Deno**: Uses `Deno.readFile()` or `fetch()` for local/remote files.
 * - **Bun**: Uses `Bun.file()` for local files or `fetch()` for URLs.
 * - **Cloudflare Workers / Edge**: Must provide WASM bytes directly
 *   (no filesystem access), or use bundled imports.
 *
 * Loaded modules are cached by name to avoid redundant fetches.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported runtime environments. */
export type RuntimeKind = 'browser' | 'node' | 'deno' | 'bun' | 'workerd' | 'unknown';

/** Configuration for custom WASM module paths. */
export interface WasmLoaderConfig {
  /**
   * Base path or URL for WASM modules.
   *
   * - In browsers, this should be a URL path (e.g. `/wasm/`).
   * - In Node.js, this should be a filesystem path.
   * - If not set, the loader attempts to resolve relative to the
   *   package installation.
   */
  basePath?: string | undefined;

  /**
   * Custom per-module paths.
   *
   * Keys are module names (e.g. `'libdeflate'`, `'png'`), values are
   * full paths or URLs to the `.wasm` file.
   *
   * These take precedence over `basePath`.
   */
  modulePaths?: Record<string, string> | undefined;

  /**
   * Pre-loaded WASM bytes keyed by module name.
   *
   * When provided, the loader skips fetching and uses these bytes
   * directly. This is the recommended approach for:
   *
   * - Cloudflare Workers (no filesystem)
   * - Bundled applications (WASM embedded in JS)
   * - Testing
   */
  moduleBytes?: Record<string, Uint8Array> | undefined;
}

/** Map of module names to their default `.wasm` filenames. */
const DEFAULT_FILENAMES: Record<string, string> = {
  libdeflate: 'modern_pdf_deflate_bg.wasm',
  png: 'modern_pdf_png_bg.wasm',
  ttf: 'modern_pdf_ttf_bg.wasm',
  shaping: 'modern_pdf_shaping_bg.wasm',
};

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** Cached loaded WASM modules. */
const moduleCache = new Map<string, Uint8Array>();

/** Global loader configuration. */
let globalConfig: WasmLoaderConfig = {};

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------

/**
 * Detect the current JavaScript runtime environment.
 *
 * @returns The detected runtime kind.
 *
 * @example
 * ```ts
 * const runtime = detectRuntime();
 * if (runtime === 'node') { ... }
 * ```
 */
export function detectRuntime(): RuntimeKind {
  // Cloudflare Workers / workerd
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof globalThis !== 'undefined' && 'caches' in globalThis && typeof (globalThis as Record<string, unknown>)['HTMLElement'] === 'undefined' && typeof (globalThis as Record<string, unknown>)['process'] === 'undefined') {
    // In Workers, there's no `process` and no `HTMLElement`, but there are caches
    // However, we need a more reliable check
    if (typeof (globalThis as Record<string, unknown>)['navigator'] === 'object') {
      const ua = (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '';
      if (ua.includes('Cloudflare-Workers')) {
        return 'workerd';
      }
    }
  }

  // Deno
  if (typeof (globalThis as Record<string, unknown>)['Deno'] === 'object') {
    return 'deno';
  }

  // Bun
  if (typeof (globalThis as Record<string, unknown>)['Bun'] === 'object') {
    return 'bun';
  }

  // Node.js
  if (
    typeof (globalThis as Record<string, unknown>)['process'] === 'object' &&
    typeof ((globalThis as Record<string, unknown>)['process'] as Record<string, unknown>)?.['versions'] === 'object' &&
    typeof (((globalThis as Record<string, unknown>)['process'] as Record<string, unknown>)?.['versions'] as Record<string, unknown>)?.['node'] === 'string'
  ) {
    return 'node';
  }

  // Browser
  if (typeof globalThis.document === 'object' || typeof globalThis.window === 'object') {
    return 'browser';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Set the global WASM loader configuration.
 *
 * Call this once at application startup before any WASM modules
 * are loaded.
 *
 * @param config - Loader configuration.
 *
 * @example
 * ```ts
 * configureWasmLoader({
 *   basePath: '/assets/wasm/',
 *   moduleBytes: { libdeflate: myBundledWasmBytes },
 * });
 * ```
 */
export function configureWasmLoader(config: WasmLoaderConfig): void {
  globalConfig = { ...config };
}

/**
 * Get the current WASM loader configuration (for testing/inspection).
 */
export function getWasmLoaderConfig(): Readonly<WasmLoaderConfig> {
  return globalConfig;
}

// ---------------------------------------------------------------------------
// Loading strategies
// ---------------------------------------------------------------------------

/**
 * Load WASM bytes using `fetch()` (works in browsers, Deno, Bun, and
 * Node.js 18+).
 *
 * @param url - URL or path to the `.wasm` file.
 * @returns     The raw WASM bytes.
 */
async function loadViaFetch(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch WASM module: ${response.status} ${response.statusText} (${url})`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Load WASM bytes from the filesystem using Node.js `fs/promises`.
 *
 * Uses dynamic import to avoid top-level CJS dependency.
 *
 * @param filePath - Absolute or relative filesystem path.
 * @returns          The raw WASM bytes.
 */
async function loadViaNodeFs(filePath: string): Promise<Uint8Array> {
  // Dynamic import of fs/promises to keep ESM-only
  try {
    // Use a variable to hide the specifier from TypeScript's static module resolution
    const fsModule = 'node:fs/promises';
    const { readFile } = (await import(/* @vite-ignore */ fsModule)) as { readFile: (path: string) => Promise<Uint8Array> };
    const buffer = await readFile(filePath);
    // Node's readFile returns a Buffer (which extends Uint8Array),
    // but we convert to a plain Uint8Array to avoid Buffer dependency
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } catch (err) {
    throw new Error(
      `Failed to load WASM module from filesystem: ${filePath} -- ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Resolve the path/URL for a WASM module given its name.
 *
 * Resolution order:
 * 1. `config.modulePaths[name]` (explicit per-module path)
 * 2. `config.basePath + DEFAULT_FILENAMES[name]` (base path + default name)
 * 3. Relative to the package directory (best-effort)
 *
 * @param name   - Module name (e.g. `'libdeflate'`).
 * @param config - Current loader config.
 * @param runtime - Detected runtime.
 * @returns        Resolved path or URL string.
 */
function resolveModulePath(
  name: string,
  config: WasmLoaderConfig,
  runtime: RuntimeKind,
): string {
  // 1. Explicit module path
  if (config.modulePaths?.[name]) {
    return config.modulePaths[name]!;
  }

  // 2. Base path + default filename
  const filename = DEFAULT_FILENAMES[name];
  if (!filename) {
    throw new Error(`Unknown WASM module: "${name}". Known modules: ${Object.keys(DEFAULT_FILENAMES).join(', ')}`);
  }

  if (config.basePath) {
    const base = config.basePath.endsWith('/') ? config.basePath : `${config.basePath}/`;
    return `${base}${filename}`;
  }

  // 3. Best-effort resolution relative to the package
  switch (runtime) {
    case 'browser':
      // Assume WASM files are served from /wasm/ path
      return `/wasm/${filename}`;

    case 'node':
    case 'bun': {
      // Try to resolve relative to this module's location
      // Note: import.meta.url gives us this file's URL
      try {
        const moduleUrl = new URL(`../wasm/${name}/pkg/${filename}`, import.meta.url);
        return moduleUrl.pathname;
      } catch {
        return `./wasm/${name}/pkg/${filename}`;
      }
    }

    case 'deno': {
      // Deno supports file:// URLs
      try {
        return new URL(`../wasm/${name}/pkg/${filename}`, import.meta.url).href;
      } catch {
        return `./wasm/${name}/pkg/${filename}`;
      }
    }

    case 'workerd':
      throw new Error(
        `Cannot auto-resolve WASM path in Workers/Edge runtime. ` +
          `Provide WASM bytes via configureWasmLoader({ moduleBytes: { ${name}: bytes } }) ` +
          `or use modulePaths configuration.`,
      );

    default:
      return `./wasm/${name}/pkg/${filename}`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a WASM module by name.
 *
 * Returns the raw `.wasm` bytes, suitable for passing to
 * `WebAssembly.compile()` or `WebAssembly.instantiate()`.
 *
 * Results are cached -- subsequent calls for the same module name
 * return the cached bytes without re-fetching.
 *
 * @param name - Module name. One of: `'libdeflate'`, `'png'`, `'ttf'`, `'shaping'`.
 * @returns      The raw WASM bytes.
 * @throws If the module cannot be loaded in the current runtime.
 *
 * @example
 * ```ts
 * // Auto-detect runtime and load
 * const wasmBytes = await loadWasmModule('libdeflate');
 *
 * // Pre-configure for Workers
 * configureWasmLoader({ moduleBytes: { libdeflate: bundledBytes } });
 * const bytes = await loadWasmModule('libdeflate');
 * ```
 */
export async function loadWasmModule(name: string): Promise<Uint8Array> {
  // 1. Check cache
  const cached = moduleCache.get(name);
  if (cached) return cached;

  // 2. Check pre-provided bytes
  if (globalConfig.moduleBytes?.[name]) {
    const bytes = globalConfig.moduleBytes[name]!;
    moduleCache.set(name, bytes);
    return bytes;
  }

  // 3. Detect runtime and load accordingly
  const runtime = detectRuntime();
  const modulePath = resolveModulePath(name, globalConfig, runtime);

  let bytes: Uint8Array;

  switch (runtime) {
    case 'node':
      // Node: prefer filesystem for local paths, fetch for URLs
      if (modulePath.startsWith('http://') || modulePath.startsWith('https://')) {
        bytes = await loadViaFetch(modulePath);
      } else {
        bytes = await loadViaNodeFs(modulePath);
      }
      break;

    case 'deno':
    case 'bun':
    case 'browser':
      // These runtimes support fetch() natively
      bytes = await loadViaFetch(modulePath);
      break;

    case 'workerd':
      // Should have been caught in resolveModulePath, but just in case
      throw new Error(
        `WASM module "${name}" cannot be auto-loaded in Workers/Edge. ` +
          `Provide bytes via configureWasmLoader().`,
      );

    default:
      // Try fetch as a last resort
      bytes = await loadViaFetch(modulePath);
      break;
  }

  // 4. Cache and return
  moduleCache.set(name, bytes);
  return bytes;
}

/**
 * Provide WASM bytes directly for a module.
 *
 * This bypasses all runtime detection and path resolution. Use this
 * for bundled scenarios or when WASM bytes are loaded through a
 * custom mechanism.
 *
 * @param name  - Module name.
 * @param bytes - Raw WASM bytes.
 *
 * @example
 * ```ts
 * // In a Cloudflare Worker
 * import wasmModule from './deflate.wasm';
 * provideWasmBytes('libdeflate', new Uint8Array(wasmModule));
 * ```
 */
export function provideWasmBytes(name: string, bytes: Uint8Array): void {
  moduleCache.set(name, bytes);
}

/**
 * Check whether a WASM module is cached (either pre-provided or
 * previously loaded).
 *
 * @param name - Module name.
 * @returns      `true` if bytes are available without loading.
 */
export function isWasmModuleCached(name: string): boolean {
  return moduleCache.has(name) || (globalConfig.moduleBytes?.[name] !== undefined);
}

/**
 * Clear the WASM module cache.
 *
 * Primarily useful for testing. Does not affect pre-provided bytes
 * in the global configuration.
 */
export function clearWasmCache(): void {
  moduleCache.clear();
}

/**
 * Reset the loader to its initial state (clears cache and config).
 *
 * Primarily useful for testing.
 */
export function resetWasmLoader(): void {
  moduleCache.clear();
  globalConfig = {};
}
