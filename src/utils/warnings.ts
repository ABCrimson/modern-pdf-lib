/**
 * @module utils/warnings
 *
 * The library's one runtime warning channel. Every warning carries the type
 * {@link WARNING_TYPE} and a stable {@link WarningCode}, and each key is
 * emitted at most once per JavaScript realm (a process's main thread, each
 * worker thread, each browser tab or worker).
 *
 * In Node and in any runtime with `process.emitWarning`, the warning goes
 * through `process.emitWarning(message, { type, code })`: Node prints it to
 * stderr and fires `process.on('warning')`, and `--disable-warning=ModernPdfLibWarning`
 * (every library warning), `--disable-warning=<code>` (one code) or
 * `--no-warnings` silences the printing. Elsewhere it goes to `console.warn`.
 *
 * The set of emitted keys lives on `globalThis` under
 * `Symbol.for('modern-pdf-lib.warnings')`, so the ESM, CJS and IIFE builds
 * loaded into one realm share it. Where `globalThis` is frozen or not
 * extensible, each loaded build keeps its own set. No package entry exports
 * this module.
 */

/** The type every library warning carries. */
export const WARNING_TYPE = 'ModernPdfLibWarning';

/**
 * The stable warning codes. Node prints the code in brackets before the type.
 *
 * - `MPL_IGNORED_OPTION`: an option was passed that has no effect.
 * - `MPL_LEGACY_R6_KEY`: an AES-256 document was opened through the legacy
 *   key derivation.
 */
export type WarningCode = 'MPL_IGNORED_OPTION' | 'MPL_LEGACY_R6_KEY';

const EMITTED_KEYS = Symbol.for('modern-pdf-lib.warnings');

/** This module's own set, used where `globalThis` cannot take the shared one. */
const localKeys = new Set<string>();

/** The realm-wide set of emitted keys, created on first use. */
function emittedKeys(): Set<string> {
  const realm = globalThis as Record<symbol, unknown>;
  const existing = realm[EMITTED_KEYS];
  if (existing instanceof Set) return existing as Set<string>;
  const created = new Set<string>();
  // Reflect.set returns false instead of throwing on a frozen or non-extensible globalThis.
  return Reflect.set(realm, EMITTED_KEYS, created) ? created : localKeys;
}

/** `process.emitWarning` where the runtime has it, else undefined. */
function emitWarningSink():
  | ((message: string, options: { type: string; code: string }) => void)
  | undefined {
  const proc = (globalThis as Record<string, unknown>)['process'] as
    | { emitWarning?: unknown }
    | undefined;
  const emit = proc?.emitWarning;
  return typeof emit === 'function'
    ? (message, options) => {
        Reflect.apply(emit, proc, [message, options]);
      }
    : undefined;
}

/**
 * Emit `message` once per realm for `key`.
 *
 * The first call for a key records it and emits through
 * `process.emitWarning(message, { type: WARNING_TYPE, code })`; where that
 * function is absent or throws, through
 * `console.warn(`${WARNING_TYPE} [${code}]: ${message}`)`. Later calls for the
 * same key emit nothing. Never throws: a sink that throws is ignored and the
 * key stays recorded, and where `globalThis` is frozen or not extensible the
 * key is recorded in this module's own set.
 *
 * @param key      What makes two warnings the same warning (for example
 *                 the entry and the option), never a caller-supplied value.
 * @param code     The stable code of the warning.
 * @param message  The text; it never contains a caller-supplied value.
 * @returns        True for the call that recorded the key, false afterwards.
 */
export function warnOnce(key: string, code: WarningCode, message: string): boolean {
  const keys = emittedKeys();
  if (keys.has(key)) return false;
  keys.add(key);
  try {
    const emit = emitWarningSink();
    if (emit !== undefined) {
      emit(message, { type: WARNING_TYPE, code });
      return true;
    }
  } catch {
    // Fall through to console.warn.
  }
  try {
    // oxlint-disable-next-line no-console -- the console is this channel's sink where process.emitWarning is absent
    console.warn(`${WARNING_TYPE} [${code}]: ${message}`);
  } catch {
    // A warning never breaks the call that emits it.
  }
  return true;
}

/**
 * Forget every emitted key in this realm, so each key warns again. For tests
 * only; no package entry exports it.
 */
export function resetWarningsForTesting(): void {
  emittedKeys().clear();
}
