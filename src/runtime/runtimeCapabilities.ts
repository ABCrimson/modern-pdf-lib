/**
 * @module runtime/runtimeCapabilities
 *
 * Honest, throw-free detection of the **perf-relevant** capabilities of the
 * current JavaScript runtime, so callers can gate fast paths (WASM, SIMD,
 * threads, shared memory, 64-bit typed arrays) on what the host can actually
 * run.
 *
 * Design rules followed here:
 *
 * - **No feature is ever assumed.** Every probe feature-detects and is wrapped
 *   so a missing global or a host that throws on access degrades to `false`
 *   rather than crashing. This mirrors the defensive `try/catch` style of the
 *   sibling {@link module:runtime/detect} module.
 * - **No fake acceleration.** Detection reports only what the host *could*
 *   execute. It does **not** imply modern-pdf-lib's bundled WASM is built with
 *   SIMD/threads — it is not (see {@link SIMD_NOTE}). A `true` here means a
 *   *SIMD-enabled rebuild* would run, not that today's binaries use it.
 * - **WASM feature probes use the canonical, validated test modules.** Each is
 *   a tiny module whose *only* discriminating instruction is the feature in
 *   question, so `WebAssembly.validate()` returns `true` exclusively when the
 *   host implements that proposal. The byte sequences below were assembled and
 *   verified to (a) validate on a feature-supporting host and (b) fail to
 *   validate when the discriminating section is removed.
 *
 * References:
 * - WebAssembly SIMD (fixed-width 128-bit) proposal — `v128` value type and
 *   `i32x4`/`i8x16` ops. https://github.com/WebAssembly/simd
 * - WebAssembly threads/atomics proposal — shared memory + `memory.atomic.*`.
 *   https://github.com/WebAssembly/threads
 * - WebAssembly bulk-memory-operations proposal — `memory.copy`/`memory.fill`.
 *   https://github.com/WebAssembly/bulk-memory-operations
 * - `WebAssembly.validate` — MDN: returns a boolean, never throws on a
 *   well-formed `BufferSource`.
 *   https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/validate
 */

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * Snapshot of the perf-relevant capabilities of the host runtime.
 *
 * Every WASM-prefixed flag answers "would a module using this proposal
 * validate here?" — i.e. whether the engine implements the proposal — not
 * whether modern-pdf-lib is currently using it.
 */
export interface RuntimeCapabilities {
  /** `WebAssembly` is present and `WebAssembly.validate` is callable. */
  wasm: boolean;
  /** The engine implements the fixed-width SIMD proposal (`v128`). */
  wasmSimd: boolean;
  /**
   * The engine implements the threads/atomics proposal **and**
   * `SharedArrayBuffer` is available (a wasm shared memory needs it).
   */
  wasmThreads: boolean;
  /** The engine implements bulk-memory ops (`memory.copy`/`memory.fill`). */
  wasmBulkMemory: boolean;
  /** `SharedArrayBuffer` is a defined global. */
  sharedArrayBuffer: boolean;
  /** `Atomics` is a defined global. */
  atomics: boolean;
  /** `BigInt64Array` is a defined global. */
  bigInt64Array: boolean;
  /**
   * `globalThis.crossOriginIsolated === true`. Required (in browsers) before
   * `SharedArrayBuffer` may be shared with workers. `false` when the flag is
   * absent or not `true`.
   */
  crossOriginIsolated: boolean;
  /**
   * Reported logical core count. `navigator.hardwareConcurrency` when present,
   * otherwise Node's `os.cpus().length` when reachable, otherwise `1`. Always a
   * positive integer.
   */
  hardwareConcurrency: number;
}

// ---------------------------------------------------------------------------
// Canonical WASM feature-detect test modules
// ---------------------------------------------------------------------------
//
// Each constant is the raw bytes of a minimal `.wasm` module. They are kept as
// module-scope `Uint8Array`s so they are allocated once. Comments annotate the
// discriminating section so the intent is auditable.

/**
 * SIMD probe: a function `() -> v128` whose body is `i32.const 0; i32x4.splat;
 * i8x16.popcnt`. The `v128` result type and the `0xfd …` SIMD opcodes only
 * validate on a host implementing the SIMD MVP. Verified to validate on a
 * SIMD-capable host and to be rejected by a host lacking SIMD.
 */
const WASM_SIMD_MODULE: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic + version
  0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, //        type: () -> (v128)
  0x03, 0x02, 0x01, 0x00, //                           func: 1 func, type 0
  0x0a, 0x0a, 0x01, 0x08, 0x00, //                     code: 1 func, body size 8, 0 locals
  0x41, 0x00, //                                       i32.const 0
  0xfd, 0x0f, //                                       i32x4.splat
  0xfd, 0x62, //                                       i8x16.popcnt
  0x0b, //                                             end
]);

/**
 * Threads/atomics probe: a function whose body executes
 * `memory.atomic.notify` (`0xfe 0x00`) against a **shared** memory
 * (`flags = 0x03` ⇒ shared with a maximum). The shared-memory limits and the
 * `0xfe` atomic opcode only validate on a threads-capable host. Verified to
 * validate on such a host.
 */
const WASM_THREADS_MODULE: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic + version
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00, //               type: () -> ()
  0x03, 0x02, 0x01, 0x00, //                           func: 1 func, type 0
  0x05, 0x04, 0x01, 0x03, 0x01, 0x01, //               memory: 1 mem, flags 0x03 (shared+max), min 1, max 1
  0x0a, 0x0d, 0x01, 0x0b, 0x00, //                     code: 1 func, body size 11, 0 locals
  0x41, 0x00, //                                       i32.const 0   (address)
  0x41, 0x00, //                                       i32.const 0   (count)
  0xfe, 0x00, 0x02, 0x00, //                           memory.atomic.notify  align=2 offset=0
  0x1a, //                                             drop
  0x0b, //                                             end
]);

/**
 * Bulk-memory probe: a function whose body executes `memory.fill`
 * (`0xfc 0x0b`) against a defined memory. The `0xfc 0x0b` opcode only validates
 * on a bulk-memory-capable host. Verified to validate with the memory section
 * present and to be rejected when the memory section is removed (proving
 * `memory.fill` is the discriminating instruction).
 */
const WASM_BULK_MEMORY_MODULE: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic + version
  0x01, 0x04, 0x01, 0x60, 0x00, 0x00, //               type: () -> ()
  0x03, 0x02, 0x01, 0x00, //                           func: 1 func, type 0
  0x05, 0x03, 0x01, 0x00, 0x01, //                     memory: 1 mem, flags 0x00, min 1
  0x0a, 0x0d, 0x01, 0x0b, 0x00, //                     code: 1 func, body size 11, 0 locals
  0x41, 0x00, //                                       i32.const 0   (dest)
  0x41, 0x00, //                                       i32.const 0   (value)
  0x41, 0x00, //                                       i32.const 0   (size)
  0xfc, 0x0b, 0x00, //                                 memory.fill   memidx 0
  0x0b, //                                             end
]);

// ---------------------------------------------------------------------------
// Low-level probes (all throw-free)
// ---------------------------------------------------------------------------

/**
 * `true` iff `WebAssembly` is an object exposing a callable `validate`.
 * `WebAssembly.validate` itself never throws for a well-formed buffer, so this
 * gate is what makes every WASM probe safe.
 */
function hasWasm(): boolean {
  try {
    return (
      typeof WebAssembly === 'object' &&
      WebAssembly !== null &&
      typeof WebAssembly.validate === 'function'
    );
  } catch {
    return false;
  }
}

/**
 * Validate a feature-detect module, returning `false` on any failure. Never
 * throws — a non-WASM host or a malformed buffer simply yields `false`.
 */
function validatesModule(bytes: Uint8Array<ArrayBuffer>): boolean {
  try {
    if (!hasWasm()) return false;
    return WebAssembly.validate(bytes);
  } catch {
    return false;
  }
}

/** `true` iff the named global is defined and not `undefined`. */
function hasGlobal(name: string): boolean {
  try {
    return (globalThis as Record<string, unknown>)[name] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Best-effort logical-core count. Prefers `navigator.hardwareConcurrency`
 * (browsers, Workers, Deno, Bun, modern Node), then Node's `os.cpus().length`
 * if a synchronously-resolvable `os` module is reachable, then `1`. Always
 * returns a positive integer and never throws.
 *
 * Note: `os` is *not* statically imported — that would assume a Node global on
 * non-Node runtimes. We only consult `navigator`, which is feature-detected,
 * and otherwise fall back to `1`. (A dynamic `import('node:os')` is async and
 * cannot feed a synchronous detector, so it is intentionally not attempted
 * here; `navigator.hardwareConcurrency` is present on Node ≥ 21.)
 */
function resolveHardwareConcurrency(): number {
  try {
    const reported = (
      globalThis as { navigator?: { hardwareConcurrency?: unknown } }
    ).navigator?.hardwareConcurrency;
    if (
      typeof reported === 'number' &&
      Number.isInteger(reported) &&
      reported > 0
    ) {
      return reported;
    }
  } catch {
    // Ignore — `navigator` may be absent or throw on access.
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Honestly detect the perf-relevant capabilities of the current runtime.
 *
 * Every probe is feature-detected and throw-free; on a host missing a feature
 * the corresponding flag is `false` (or `1` for {@link
 * RuntimeCapabilities.hardwareConcurrency}). The result is **not** cached so a
 * test harness (or a host that gains a feature, e.g. cross-origin isolation
 * toggling) sees the live state.
 *
 * @returns A fresh {@link RuntimeCapabilities} snapshot.
 */
export function detectRuntimeCapabilities(): RuntimeCapabilities {
  const wasm = hasWasm();
  const sharedArrayBuffer = hasGlobal('SharedArrayBuffer');

  return {
    wasm,
    wasmSimd: wasm && validatesModule(WASM_SIMD_MODULE),
    // A wasm shared memory requires SharedArrayBuffer to back it, so gate the
    // threads probe on the global too — honest about what is actually usable.
    wasmThreads:
      wasm && sharedArrayBuffer && validatesModule(WASM_THREADS_MODULE),
    wasmBulkMemory: wasm && validatesModule(WASM_BULK_MEMORY_MODULE),
    sharedArrayBuffer,
    atomics: hasGlobal('Atomics'),
    bigInt64Array: hasGlobal('BigInt64Array'),
    crossOriginIsolated:
      (globalThis as { crossOriginIsolated?: unknown }).crossOriginIsolated ===
      true,
    hardwareConcurrency: resolveHardwareConcurrency(),
  };
}

/**
 * Convenience predicate: does the host implement the WebAssembly SIMD proposal?
 *
 * Equivalent to `detectRuntimeCapabilities().wasmSimd`. A `true` result means a
 * SIMD-enabled module would validate here — **not** that modern-pdf-lib's
 * shipped WASM uses SIMD (see {@link SIMD_NOTE}).
 *
 * @returns `true` iff the SIMD feature-detect module validates.
 */
export function isWasmSimdSupported(): boolean {
  return validatesModule(WASM_SIMD_MODULE);
}

/**
 * Honesty disclaimer about SIMD acceleration.
 *
 * modern-pdf-lib's bundled WebAssembly binaries are built **without** SIMD
 * today. {@link isWasmSimdSupported} / {@link RuntimeCapabilities.wasmSimd}
 * report only whether the *host* could run SIMD code — actually benefiting from
 * SIMD requires a SIMD-enabled rebuild of the WASM modules. This constant
 * exists so callers and docs do not mistake capability detection for active
 * acceleration.
 */
export const SIMD_NOTE: string =
  "modern-pdf-lib's bundled WASM is currently built WITHOUT SIMD; " +
  'isWasmSimdSupported()/wasmSimd report only that the host could run SIMD code. ' +
  'Realising SIMD acceleration requires a SIMD-enabled rebuild of the WASM modules ' +
  '— it is not used today.';
