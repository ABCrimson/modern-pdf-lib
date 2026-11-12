/**
 * The ledger of PDF outputs a test of the oracle project writes and the ones it checks.
 *
 * tests/helpers/oracle/setup.ts records every `PdfDocument.save()` and `saveAsStream()` output a
 * test makes; expectQpdfClean() (tests/helpers/oracle/qpdf.ts) marks the bytes it checks. Outputs
 * are compared by SHA-256, so a copy of the bytes counts as the same output. The ledger is reset
 * before each test.
 */
import { createHash } from 'node:crypto';

const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const written: { readonly what: string; readonly hash: string }[] = [];
const checked = new Set<string>();

/** Records one output of the running test; `what` names the call that wrote it. */
export function recordOutput(what: string, bytes: Uint8Array): void {
  written.push({ what, hash: digest(bytes) });
}

/** Marks bytes as passed to an outside checker. */
export function markChecked(bytes: Uint8Array): void {
  checked.add(digest(bytes));
}

/** The calls whose outputs were recorded but never marked checked, in recording order. */
export function uncheckedOutputs(): string[] {
  return written.filter((w) => !checked.has(w.hash)).map((w) => w.what);
}

/** Forgets every recorded and checked output. */
export function resetOutputs(): void {
  written.length = 0;
  checked.clear();
}
