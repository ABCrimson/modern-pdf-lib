/**
 * Entries of unsupported-filters.test.ts. The budgeted runner loads this module in a worker and
 * calls one named export with the input bytes and the task's args. Each entry hands its input to
 * one entry point of a format this release does not decode (JPEG 2000, JBIG2, lossy WebP) or to
 * the lossless WebP path; the entries of the first kind return nothing because they throw.
 */
import { PdfDict, PdfName } from '../../src/core/pdfObjects.js';
import { decodeWebP } from '../../src/assets/image/webpDecode.js';
import { decodeJBIG2, decodeJBIG2Async } from '../../src/codecs/jbig2/jbig2Decode.js';
import { decodeJpeg2000 } from '../../src/codecs/jpeg2000/jpeg2000Decode.js';
import {
  assembleTiles,
  decodeTile,
  decodeTileRegion,
} from '../../src/codecs/jpeg2000/jpeg2000Tiles.js';
import { transcodeJp2ToJpeg } from '../../src/codecs/internal/jpeg2000Transcode.js';
import { decodeStream } from '../../src/codecs/streamDecode.js';
import type { JsonValue } from '../helpers/budget.js';

/** `decodeJpeg2000` on the input. */
export function decodeJpeg2000Entry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { width: decodeJpeg2000(bytes).width };
}

/** `decodeTile` on tile 0 of the input. */
export function decodeTileEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { index: decodeTile(bytes, 0).index };
}

/** `decodeTileRegion` on a 64 x 64 region of the input. */
export function decodeTileRegionEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: decodeTileRegion(bytes, { x: 0, y: 0, width: 64, height: 64 }).length };
}

/** `assembleTiles` with no tiles and the grid of a 65535 x 65535 image. */
export function assembleTilesEntry(_bytes: Uint8Array, _args: JsonValue): JsonValue {
  return {
    length: assembleTiles([], {
      imageWidth: 65535,
      imageHeight: 65535,
      tileWidth: 65535,
      tileHeight: 65535,
      tilesX: 1,
      tilesY: 1,
      originX: 0,
      originY: 0,
      components: 3,
      bitsPerComponent: 8,
    }).length,
  };
}

/** `transcodeJp2ToJpeg` on the input. */
export async function transcodeEntry(bytes: Uint8Array, _args: JsonValue): Promise<JsonValue> {
  return { length: (await transcodeJp2ToJpeg(bytes)).length };
}

/** `decodeStream` with the filter named in `args`. */
export function decodeStreamEntry(bytes: Uint8Array, args: JsonValue): JsonValue {
  return { length: decodeStream(bytes, args as string).length };
}

/** `decodeJBIG2` on the input. */
export function decodeJbig2Entry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  return { length: decodeJBIG2(bytes, null).length };
}

/** `decodeJBIG2` with a /DecodeParms dictionary. */
export function decodeJbig2ParmsEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  const parms = new PdfDict();
  parms.set('/JBIG2Globals', PdfName.of('None'));
  return { length: decodeJBIG2(bytes, parms).length };
}

/** `decodeJBIG2Async` on the input (the WASM module is not loadable in the worker's sandbox or fails first). */
export async function decodeJbig2AsyncEntry(
  bytes: Uint8Array,
  _args: JsonValue,
): Promise<JsonValue> {
  return { length: (await decodeJBIG2Async(bytes, null)).length };
}

/** `decodeWebP` on the input. */
export function decodeWebPEntry(bytes: Uint8Array, _args: JsonValue): JsonValue {
  const image = decodeWebP(bytes);
  return { width: image.width, height: image.height, channels: image.channels };
}
