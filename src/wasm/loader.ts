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

import { hasInlineWasmData, getInlineWasmBytes } from './inlineWasm.js';
import { EnvironmentError, InvalidArgumentError } from '../errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported runtime environments. */
export type RuntimeKind =
  | 'browser'
  | 'node'
  | 'deno'
  | 'bun'
  | 'workerd'
  | 'service-worker'
  | 'unknown';

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

  /**
   * Disable all WASM loading.
   *
   * When set to `true`, all calls to `loadWasmModule()` will throw
   * an error, forcing the library to use pure-JS fallback
   * implementations instead.
   *
   * This is useful for environments with strict Content Security
   * Policies that do not allow `wasm-unsafe-eval`.
   */
  disableWasm?: boolean | undefined;
}

/** Map of module names to their default `.wasm` filenames. */
const DEFAULT_FILENAMES: Record<string, string> = {
  libdeflate: 'modern_pdf_deflate_bg.wasm',
  png: 'modern_pdf_png_bg.wasm',
  ttf: 'modern_pdf_ttf_bg.wasm',
  shaping: 'modern_pdf_shaping_bg.wasm',
  jbig2: 'modern_pdf_jbig2_bg.wasm',
  jpeg: 'modern_pdf_jpeg_bg.wasm',
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
  if ('caches' in globalThis && !('HTMLElement' in globalThis) && !('process' in globalThis)) {
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
  if ('Deno' in globalThis) {
    return 'deno';
  }

  // Bun
  if ('Bun' in globalThis) {
    return 'bun';
  }

  // Node.js
  if (
    typeof (globalThis as Record<string, unknown>)['process'] === 'object' &&
    typeof ((globalThis as Record<string, unknown>)['process'] as Record<string, unknown>)?.[
      'versions'
    ] === 'object' &&
    typeof (
      ((globalThis as Record<string, unknown>)['process'] as Record<string, unknown>)?.[
        'versions'
      ] as Record<string, unknown>
    )?.['node'] === 'string'
  ) {
    return 'node';
  }

  // Service Worker (must come before the generic browser check —
  // Service Workers have `self` and `fetch` but NO `document` or `window`)
  if (
    typeof (globalThis as Record<string, unknown>)['ServiceWorkerGlobalScope'] === 'function' &&
    typeof self !== 'undefined' &&
    self instanceof
      ((globalThis as Record<string, unknown>)['ServiceWorkerGlobalScope'] as new (
        ...args: unknown[]
      ) => unknown)
  ) {
    return 'service-worker';
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
    throw new EnvironmentError(
      `Failed to fetch WASM module: ${response.status} ${response.statusText} (${url})`,
      { reason: 'network' },
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * The URL of a packaged WASM module: the file `wasm/<name>/<file>` next to the loader.
 *
 * The URL keeps a space or a non-ASCII letter of the install directory as a percent-escape; a
 * file system turns it into a path with {@link toFileSystemPath}, and `fetch` takes it as it is.
 *
 * @param name     - Module name (e.g. `'libdeflate'`).
 * @param filename - Default file name of the module (e.g. `'modern_pdf_deflate_bg.wasm'`).
 * @param base     - URL of the loader module, the default being this module's own.
 * @returns          The URL of the module's `.wasm` file.
 *
 * @internal
 */
export function packagedModuleUrl(
  name: string,
  filename: string,
  base: string = import.meta.url,
): string {
  return new URL(`./wasm/${name}/${filename}`, base).href;
}

/**
 * The file system path that a location names, when the location is a `file:` URL; any other
 * location (a path or an `http(s):` URL) comes back unchanged.
 *
 * `URL.pathname` is not a path: it keeps `%20` and the other escapes, starts a Windows path with a
 * slash (`/C:/dir`) and drops the host of a UNC share. `fileURLToPath` of `node:url` decodes the
 * escapes and gives `C:\dir`, `\\host\share\dir` or `/dir` for the platform that reads it.
 *
 * The module is imported on demand, so a browser bundle holds no Node built-in.
 *
 * @param location - A file path, or a `file:` or `http(s):` URL.
 * @param options  - `windows` forces the Windows (`true`) or the POSIX (`false`) rules of the
 *                   conversion instead of the rules of the running platform.
 * @returns          The file system path, or `location` itself when it is not a `file:` URL.
 * @throws {TypeError} If a `file:` URL names no path on the platform (an encoded slash, a host on POSIX).
 *
 * @internal
 */
export async function toFileSystemPath(
  location: string,
  options?: { windows?: boolean },
): Promise<string> {
  if (!/^file:/i.test(location)) return location;
  // A variable specifier hides it from the static module resolution of TypeScript and of bundlers
  const urlModule = 'node:url';
  const { fileURLToPath } = (await import(/* @vite-ignore */ urlModule)) as {
    fileURLToPath: (url: string, options?: { windows?: boolean }) => string;
  };
  return fileURLToPath(location, options);
}

/**
 * Load WASM bytes from the filesystem using Node.js `fs/promises`.
 *
 * Uses dynamic import to avoid top-level CJS dependency.
 *
 * @param location - Absolute or relative filesystem path, or a `file:` URL.
 * @returns          The raw WASM bytes.
 */
async function loadViaNodeFs(location: string): Promise<Uint8Array> {
  // Dynamic import of fs/promises to keep ESM-only
  try {
    // Use a variable to hide the specifier from TypeScript's static module resolution
    const fsModule = 'node:fs/promises';
    const { readFile } = (await import(/* @vite-ignore */ fsModule)) as {
      readFile: (path: string) => Promise<Uint8Array>;
    };
    const buffer = await readFile(await toFileSystemPath(location));
    // Node's readFile returns a Buffer (which extends Uint8Array),
    // but we convert to a plain Uint8Array to avoid Buffer dependency
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } catch (err) {
    throw new EnvironmentError(
      `Failed to load WASM module from filesystem: ${location} -- ${err instanceof Error ? err.message : String(err)}`,
      { reason: 'wasm', cause: err },
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
function resolveModulePath(name: string, config: WasmLoaderConfig, runtime: RuntimeKind): string {
  // 1. Explicit module path
  if (config.modulePaths?.[name]) {
    return config.modulePaths[name]!;
  }

  // 2. Base path + default filename
  const filename = DEFAULT_FILENAMES[name];
  if (!filename) {
    throw new InvalidArgumentError(
      `Unknown WASM module: "${name}". Known modules: ${Object.keys(DEFAULT_FILENAMES).join(', ')}`,
      { argument: 'name' },
    );
  }

  if (config.basePath) {
    const base = config.basePath.endsWith('/') ? config.basePath : `${config.basePath}/`;
    return `${base}${filename}`;
  }

  // 3. Best-effort resolution relative to the package
  switch (runtime) {
    case 'browser':
    case 'service-worker':
      // Assume WASM files are served from /wasm/ path
      return `/wasm/${filename}`;

    case 'node':
    case 'bun':
    case 'deno':
      // The packaged file next to this module: in dist (dist/loader-*.mjs) it is ./wasm/<name>/<file>.
      // It stays a URL: Node turns it into a file path where it reads it (toFileSystemPath), and
      // fetch() in Bun and Deno reads a file: URL as it is.
      return packagedModuleUrl(name, filename);

    case 'workerd':
      throw new EnvironmentError(
        `Cannot auto-resolve WASM path in Workers/Edge runtime. ` +
          `Provide WASM bytes via configureWasmLoader({ moduleBytes: { ${name}: bytes } }) ` +
          `or use modulePaths configuration.`,
        { reason: 'wasm' },
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
 * @param name - Module name. One of: `'libdeflate'`, `'png'`, `'ttf'`, `'shaping'`, `'jbig2'`.
 * @returns      The raw WASM bytes.
 * @throws {InvalidArgumentError} If the module name is not one the loader knows.
 * @throws {EnvironmentError} If the module cannot be loaded in the current runtime, or WASM is disabled.
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
  // 0. Check if WASM is globally disabled
  if (globalConfig.disableWasm) {
    throw new EnvironmentError(
      'WASM loading is disabled via configureWasmLoader({ disableWasm: true }). Using pure-JS fallbacks.',
      { reason: 'wasm' },
    );
  }

  // 1. Check cache
  const cached = moduleCache.get(name);
  if (cached) return cached;

  // 2. Check pre-provided bytes
  if (globalConfig.moduleBytes?.[name]) {
    const bytes = globalConfig.moduleBytes[name]!;
    moduleCache.set(name, bytes);
    return bytes;
  }

  // 3. Try inline WASM data (zero-config: no file paths needed)
  if (hasInlineWasmData(name)) {
    try {
      const bytes = getInlineWasmBytes(name);
      moduleCache.set(name, bytes);
      return bytes;
    } catch {
      // Inline data failed — fall through to file/network loading
    }
  }

  // 4. Detect runtime and load accordingly
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
    case 'service-worker':
      // These runtimes support fetch() natively
      bytes = await loadViaFetch(modulePath);
      break;

    case 'workerd':
      // Should have been caught in resolveModulePath, but just in case
      throw new EnvironmentError(
        `WASM module "${name}" cannot be auto-loaded in Workers/Edge. ` +
          `Provide bytes via configureWasmLoader().`,
        { reason: 'wasm' },
      );

    default:
      // Try fetch as a last resort
      bytes = await loadViaFetch(modulePath);
      break;
  }

  // 5. Cache and return
  moduleCache.set(name, bytes);
  return bytes;
}

/**
 * Load and compile a WASM module using streaming compilation when available.
 *
 * In browsers with `WebAssembly.compileStreaming`, this compiles the module
 * while the response is still downloading, significantly reducing load time.
 * Falls back to `WebAssembly.compile` on the raw bytes when streaming is
 * not available (Node.js, older browsers).
 *
 * @param name - Module name (e.g., 'libdeflate', 'png').
 * @returns A compiled WebAssembly.Module ready for instantiation.
 *
 * @example
 * ```ts
 * const module = await loadWasmModuleStreaming('libdeflate');
 * const instance = await WebAssembly.instantiate(module, imports);
 * ```
 */
export async function loadWasmModuleStreaming(name: string): Promise<WebAssembly.Module> {
  // Check if WASM is globally disabled
  if (globalConfig.disableWasm) {
    throw new EnvironmentError(
      'WASM loading is disabled via configureWasmLoader({ disableWasm: true }). Using pure-JS fallbacks.',
      { reason: 'wasm' },
    );
  }

  // Check if pre-provided bytes are available -- compile directly
  if (globalConfig.moduleBytes?.[name]) {
    return WebAssembly.compile(globalConfig.moduleBytes[name]! as BufferSource);
  }

  // Check module cache -- compile from cached bytes
  const cached = moduleCache.get(name);
  if (cached) {
    return WebAssembly.compile(cached as BufferSource);
  }

  const runtime = detectRuntime();
  const modulePath = resolveModulePath(name, globalConfig, runtime);

  // In browser context with compileStreaming available, use streaming
  if (
    (runtime === 'browser' || runtime === 'service-worker') &&
    typeof WebAssembly.compileStreaming === 'function'
  ) {
    const response = fetch(modulePath);
    return WebAssembly.compileStreaming(response);
  }

  // Fallback: load bytes then compile
  const bytes = await loadWasmModule(name);
  return WebAssembly.compile(bytes as BufferSource);
}

/**
 * Load, compile, and instantiate a WASM module with streaming when available.
 *
 * In browsers with `WebAssembly.instantiateStreaming`, this compiles and
 * instantiates the module while the response is still downloading.
 * Falls back to `WebAssembly.instantiate` on the raw bytes when streaming
 * is not available (Node.js, older browsers).
 *
 * @param name    - Module name (e.g., 'libdeflate', 'png').
 * @param imports - WebAssembly import object.
 * @returns An instantiated WebAssembly module.
 *
 * @example
 * ```ts
 * const instance = await instantiateWasmModuleStreaming('libdeflate', {});
 * const { compress } = instance.exports;
 * ```
 */
export async function instantiateWasmModuleStreaming(
  name: string,
  imports: WebAssembly.Imports = {},
): Promise<WebAssembly.Instance> {
  // Check if WASM is globally disabled
  if (globalConfig.disableWasm) {
    throw new EnvironmentError(
      'WASM loading is disabled via configureWasmLoader({ disableWasm: true }). Using pure-JS fallbacks.',
      { reason: 'wasm' },
    );
  }

  // Pre-provided bytes
  if (globalConfig.moduleBytes?.[name]) {
    const result = await WebAssembly.instantiate(
      globalConfig.moduleBytes[name]! as BufferSource,
      imports,
    );
    return result.instance;
  }

  // Cached bytes
  const cached = moduleCache.get(name);
  if (cached) {
    const result = await WebAssembly.instantiate(cached as BufferSource, imports);
    return result.instance;
  }

  const runtime = detectRuntime();
  const modulePath = resolveModulePath(name, globalConfig, runtime);

  // In browser context with instantiateStreaming available, use streaming
  if (
    (runtime === 'browser' || runtime === 'service-worker') &&
    typeof WebAssembly.instantiateStreaming === 'function'
  ) {
    const response = fetch(modulePath);
    const { instance } = await WebAssembly.instantiateStreaming(response, imports);
    return instance;
  }

  // Fallback: load bytes then instantiate
  const bytes = await loadWasmModule(name);
  const result = await WebAssembly.instantiate(bytes as BufferSource, imports);
  return result.instance;
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
  return moduleCache.has(name) || globalConfig.moduleBytes?.[name] !== undefined;
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
 * Check whether WASM loading has been globally disabled.
 *
 * @returns `true` if `configureWasmLoader({ disableWasm: true })` was called.
 *
 * @example
 * ```ts
 * configureWasmLoader({ disableWasm: true });
 * console.log(isWasmDisabled()); // true
 * ```
 */
export function isWasmDisabled(): boolean {
  return globalConfig.disableWasm === true;
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
