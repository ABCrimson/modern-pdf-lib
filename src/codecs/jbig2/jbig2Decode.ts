/**
 * @module codecs/jbig2/jbig2Decode
 *
 * Entry points for the PDF JBIG2Decode filter.
 *
 * JBIG2 (ITU-T T.88 / ISO/IEC 14492) is a bilevel image compression
 * standard. This release does not decode it in JavaScript:
 * {@link decodeJBIG2} throws {@link UnsupportedFilterError} for every input,
 * and {@link decodeJBIG2Async} rejects with it unless the WASM module is
 * loaded and decodes the data.
 *
 * Reference: PDF 1.7 spec, SS7.4.7; ITU-T T.88.
 *
 * @packageDocumentation
 */

import { UnsupportedFilterError } from '../../errors.js';
import type { PdfDict } from '../../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// WASM bridge (optional acceleration)
// ---------------------------------------------------------------------------

/** Cached WASM bridge state — avoids repeated dynamic imports. */
let wasmAttempted = false;
let wasmAvailable = false;

/**
 * Try to load the JBIG2 WASM bridge.  Returns `true` if WASM is ready.
 * On failure, returns `false`.
 */
async function tryLoadJBIG2Wasm(): Promise<boolean> {
  if (wasmAttempted) return wasmAvailable;
  wasmAttempted = true;

  try {
    const { initJBIG2Wasm, isJBIG2WasmAvailable } =
      await import('../../wasm/internal/jbig2WasmBridge.js');
    await initJBIG2Wasm();
    wasmAvailable = isJBIG2WasmAvailable();
    return wasmAvailable;
  } catch {
    wasmAvailable = false;
    return false;
  }
}

/**
 * Reset WASM bridge state.  Primarily useful for testing.
 */
export function resetJBIG2WasmBridge(): void {
  wasmAttempted = false;
  wasmAvailable = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decode JBIG2Decode stream data.
 *
 * Throws {@link UnsupportedFilterError} (filter `'JBIG2Decode'`): JBIG2 image
 * data is not decoded in this release. Empty data is not an exception, and
 * neither argument is read.
 *
 * @param _data  - The JBIG2-encoded content stream bytes (not read).
 * @param _parms - Optional `/DecodeParms` dictionary (not read).
 * @throws {UnsupportedFilterError} Always.
 */
export function decodeJBIG2(_data: Uint8Array, _parms: PdfDict | null): Uint8Array {
  throw new UnsupportedFilterError('JBIG2Decode');
}

/**
 * Decode JBIG2Decode stream data with optional WASM acceleration.
 *
 * Uses the WASM-based decoder when the module is loaded.  Without the WASM
 * module, or when its decode fails, this rejects with
 * {@link UnsupportedFilterError} (filter `'JBIG2Decode'`).
 *
 * @param data  - The JBIG2-encoded content stream bytes.
 * @param parms - Optional `/DecodeParms` dictionary.
 * @returns The decoded bilevel image data.
 */
export async function decodeJBIG2Async(
  data: Uint8Array,
  parms: PdfDict | null,
): Promise<Uint8Array> {
  const globalsData = extractGlobals(parms);

  // Try WASM first
  if (await tryLoadJBIG2Wasm()) {
    try {
      const { decodeJBIG2Wasm } = await import('../../wasm/internal/jbig2WasmBridge.js');
      const result = decodeJBIG2Wasm(data, globalsData);
      return result.bitmapData;
    } catch {
      // WASM decode failed — fall through to JS
    }
  }

  // No JavaScript decoder: this throws UnsupportedFilterError
  return decodeJBIG2(data, parms);
}

// ---------------------------------------------------------------------------
// Extract global segment data from DecodeParms
// ---------------------------------------------------------------------------

/**
 * The JBIG2Globals parameter may be a stream whose data contains
 * global segments.  In our object model it appears as a PdfDict
 * with a `/data` or raw bytes property.  For now, if the parms
 * dictionary contains `/JBIG2Globals`, we try to extract its byte
 * data.
 */
function extractGlobals(parms: PdfDict | null): Uint8Array | null {
  if (!parms) return null;

  const globals = parms.get('/JBIG2Globals');
  if (!globals) return null;

  // If it's a stream-like object with decoded data, access it
  // The PdfStream class typically has a `data` or `decodedData` property
  if (globals && typeof globals === 'object') {
    // Try common patterns for stream data
    const obj = globals as unknown as Record<string, unknown>;
    if (obj['decodedData'] instanceof Uint8Array) {
      return obj['decodedData'] as Uint8Array;
    }
    if (obj['data'] instanceof Uint8Array) {
      return obj['data'] as Uint8Array;
    }
    if (obj['rawData'] instanceof Uint8Array) {
      return obj['rawData'] as Uint8Array;
    }
  }

  return null;
}
