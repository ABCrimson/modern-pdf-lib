/**
 * @module barcode/internal/removedOptions
 *
 * The run-time guard of the options that 0.41.0 removed from the barcode renderers. The options
 * left the option types, which stops a TypeScript caller; a JavaScript caller, a spread object or
 * a cast can still pass them, so each renderer refuses them here instead of ignoring them.
 */

import { UNSUPPORTED_OPTIONS, rejectOption } from '../../internal/options.js';
import type { UnsupportedOptionRule } from '../../internal/options.js';

/** The rows of the option table, by entry (`code128ToOperators()`). */
const RULES_BY_ENTRY: ReadonlyMap<string, readonly UnsupportedOptionRule[]> = Map.groupBy(
  UNSUPPORTED_OPTIONS,
  (rule) => rule.entry,
);

/** The removed options that only the value `true` passed; `false` asked for nothing. */
const FLAGS: ReadonlySet<string> = new Set(['showText', 'includeCheckDigit']);

/**
 * Refuse the removed options of `entry` that `options` carries. A flag (`showText`,
 * `includeCheckDigit`) counts when it is `true`; any other option counts when it is not
 * `undefined`. The first such option in the order of the option table is refused.
 *
 * Removed in 0.50.0 with the other guards of removed options.
 *
 * @param entry    The function, as the option table spells it: `code128ToOperators()`.
 * @param options  The options argument of the call; a value that is not an object carries no
 *                 option and passes, as in 0.40.9.
 * @throws {UnsupportedOptionError}  When `options` carries a removed option of `entry`.
 */
export function rejectRemovedOptions(entry: string, options: unknown): void {
  if (typeof options !== 'object' || options === null) return;
  for (const rule of RULES_BY_ENTRY.get(entry) ?? []) {
    if (rule.option === undefined) continue;
    const value: unknown = Reflect.get(options, rule.option);
    if (FLAGS.has(rule.option) ? value === true : value !== undefined) rejectOption(rule);
  }
}
