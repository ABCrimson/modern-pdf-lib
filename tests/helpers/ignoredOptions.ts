/**
 * What every ignored-option test file shares: the warning type, the code, and the message an
 * entry that accepts an option and does not act on it emits (`warnOnce` in `src`).
 */

export const TYPE = 'ModernPdfLibWarning';
export const CODE = 'MPL_IGNORED_OPTION';

/** The message for `subject` (the entry as it appears in the text, with `()` for a function). */
export const ignoredOptionMessage = (subject: string, option: string): string =>
  `\`${subject}\`: the option \`${option}\` has no effect in this version.`;
