/**
 * Entries of encrypted-load-limits.test.ts. The budgeted runner loads this module in a worker and
 * calls one named export with the input bytes and the task's args.
 */
import { loadPdf } from '../../src/index.js';
import type { PdfObject, PdfString } from '../../src/index.js';
import type { JsonValue } from '../helpers/budget.js';

/** Loads an encrypted PDF whose user password is empty and returns its page count. */
export async function loadEncryptedEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  const doc = await loadPdf(bytes);
  return { pages: doc.getPageCount() };
}

/**
 * Loads an encrypted PDF whose user password is empty and returns the length of its largest
 * array and how many of its items are the string `s<index>`.
 */
export async function loadStringsEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  const doc = await loadPdf(bytes);
  let largest: readonly PdfObject[] = [];
  for (const { object } of doc.getRegistry()) {
    if (object.kind === 'array' && object.items.length > largest.length) largest = object.items;
  }
  const matching = largest.filter(
    (item, i) => item.kind === 'string' && (item as PdfString).toText() === `s${i}`,
  );
  return { items: largest.length, matching: matching.length };
}
