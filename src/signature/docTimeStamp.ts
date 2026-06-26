/**
 * @module signature/docTimeStamp
 *
 * Standalone Document Timestamp signature dictionary builder
 * (ISO 32000-2 §12.8.5, subtype `ETSI.RFC3161`).
 *
 * A *Document Timestamp* (DTS) is a special signature dictionary whose
 * `/Type` is `/DocTimeStamp` and whose `/SubFilter` is `/ETSI.RFC3161`.
 * Unlike an ordinary approval/certification signature, a DTS does not
 * sign on behalf of a person — instead its `/Contents` holds a bare
 * RFC 3161 TimeStampToken (a CMS `SignedData` produced by a TSA) that
 * proves the document existed, unmodified, at a particular instant.
 *
 * Document timestamps are the foundation of PAdES-LTV: each successive
 * incremental-save DTS extends the trustworthiness window of the
 * underlying signatures (and any DSS revocation data) into the future.
 *
 * This module only builds the *dictionary skeleton*.  The `/ByteRange`
 * (here `[0 0 0 0]`) and `/Contents` (a zero-filled hex placeholder of
 * `contentsSize` bytes) are filled in later, during an incremental
 * save, once the final byte offsets and the TSA token are known.  The
 * actual RFC 3161 token can be obtained via {@link requestTimestamp}
 * from {@link module:signature/timestamp}.
 *
 * References:
 * - ISO 32000-2 §12.8.5 (Document timestamp dictionary)
 * - ETSI EN 319 142-1 (PAdES) — DocTimeStamp / LTV
 * - RFC 3161 (Time-Stamp Protocol)
 *
 * @packageDocumentation
 */

import {
  PdfDict,
  PdfName,
  PdfArray,
  PdfString,
} from '../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default size, in bytes, of the `/Contents` placeholder.
 *
 * An RFC 3161 TimeStampToken (including the TSA certificate chain) is
 * typically a few kilobytes; 8192 bytes (16384 hex digits) leaves ample
 * room for most TSAs while keeping the placeholder modest.
 */
export const DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE: number = 8192;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options controlling how the Document Timestamp dictionary is built.
 */
export interface DocTimeStampOptions {
  /**
   * Number of bytes reserved for the `/Contents` placeholder.  This must
   * be large enough to hold the DER-encoded TimeStampToken returned by
   * the TSA.  Defaults to {@link DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE}.
   */
  readonly contentsSize?: number | undefined;
  /**
   * Optional human-readable reason recorded in the signature dictionary's
   * `/Reason` field.  Purely informational for a timestamp.
   */
  readonly reason?: string | undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a standalone Document Timestamp signature dictionary.
 *
 * The returned {@link PdfDict} contains:
 * - `/Type`      `/DocTimeStamp`
 * - `/Filter`    `/Adobe.PPKLite`
 * - `/SubFilter` `/ETSI.RFC3161`
 * - `/ByteRange` `[0 0 0 0]` — a placeholder to be patched during save
 * - `/Contents`  a zero-filled hex string of `contentsSize` bytes
 * - `/Reason`    (only when {@link DocTimeStampOptions.reason} is given)
 *
 * The `/Contents` value is serialized as a hexadecimal string
 * (`<0000…>`); it occupies `contentsSize` bytes ⇒ `2 × contentsSize`
 * hex digits.  The real RFC 3161 TimeStampToken is injected over this
 * placeholder later, during incremental save.
 *
 * @param options  Optional configuration.
 * @returns        The Document Timestamp signature dictionary.
 * @throws         {RangeError} when `contentsSize` is not a positive
 *                 integer.
 *
 * @example
 * ```ts
 * const dts = buildDocTimeStampDict({ contentsSize: 16384 });
 * const ref = registry.register(dts);
 * // …later, during incremental save, patch /ByteRange and /Contents
 * // with the offsets and the TSA token from requestTimestamp().
 * ```
 */
export function buildDocTimeStampDict(options?: DocTimeStampOptions): PdfDict {
  const contentsSize =
    options?.contentsSize ?? DEFAULT_DOC_TIMESTAMP_CONTENTS_SIZE;

  if (!Number.isInteger(contentsSize) || contentsSize <= 0) {
    throw new RangeError(
      `contentsSize must be a positive integer, got ${String(contentsSize)}`,
    );
  }

  const dict = new PdfDict();
  dict.set('/Type', PdfName.of('/DocTimeStamp'));
  dict.set('/Filter', PdfName.of('/Adobe.PPKLite'));
  dict.set('/SubFilter', PdfName.of('/ETSI.RFC3161'));

  // /ByteRange placeholder — patched with real offsets during save.
  dict.set('/ByteRange', PdfArray.fromNumbers([0, 0, 0, 0]));

  // /Contents placeholder — a hex string of `contentsSize` zero bytes,
  // i.e. 2 * contentsSize hex digits.  Built without intermediate
  // per-byte allocations.
  const hexZeros = '0'.repeat(contentsSize * 2);
  dict.set('/Contents', PdfString.hex(hexZeros));

  if (options?.reason !== undefined) {
    dict.set('/Reason', PdfString.literal(options.reason));
  }

  return dict;
}
