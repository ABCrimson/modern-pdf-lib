/**
 * Entries of flate-limits.test.ts. The budgeted runner loads this module in a worker and calls one
 * named export with the input bytes and the task's args. Each entry decodes its input through one
 * public or internal Flate path and returns the decoded length.
 */
import { inflateFlate, inflateRaw } from '../../src/codecs/internal/pdfFlate.js';
import { PdfDict, PdfName, PdfStream } from '../../src/core/pdfObjects.js';
import { loadPdf } from '../../src/index.js';
import { decodeFlateOnly, decodeStream } from '../../src/codecs/streamDecode.js';
import { beginCall } from '../../src/internal/limits.js';
import { DEFAULT_LIMITS } from '../../src/limits.js';
import type { JsonValue } from '../helpers/budget.js';

/** `inflateFlate` on zlib data, under the default limits. */
export function inflateFlateEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: inflateFlate(bytes, beginCall(DEFAULT_LIMITS)).length };
}

/** `inflateRaw` on the DEFLATE payload of zlib data (the two header bytes dropped), under the default limits. */
export function inflateRawEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: inflateRaw(bytes.subarray(2), beginCall(DEFAULT_LIMITS)).length };
}

/** `decodeFlateOnly`, the xref-stream and object-stream decoder, on a stream whose /Filter is /FlateDecode. */
export function decodeFlateOnlyEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  const dict = new PdfDict();
  dict.set('/Filter', PdfName.of('FlateDecode'));
  return {
    length: decodeFlateOnly(new PdfStream(dict, bytes), beginCall(DEFAULT_LIMITS))?.length ?? -1,
  };
}

/** `decodeStream` with the filter chain [/FlateDecode /FlateDecode]. */
export function decodeChainEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: decodeStream(bytes, ['FlateDecode', 'FlateDecode']).length };
}

/** Loads a PDF and decodes the content stream of its first page. */
export async function loadedPageStreamEntry(
  bytes: Uint8Array,
  _args: JsonValue,
): Promise<JsonValue> {
  const doc = await loadPdf(bytes);
  return { length: doc.getPage(0).getContentStream().length };
}
