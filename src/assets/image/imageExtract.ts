/**
 * @module assets/image/imageExtract
 *
 * Extract image XObjects from a parsed PDF document.
 *
 * Walks all pages and collects metadata about each image XObject,
 * including decoded pixel data when possible.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

import type { PdfDocument } from '../../core/pdfDocument.js';
import {
  PdfDict,
  PdfName,
  PdfNumber,
  PdfArray,
  PdfRef,
  PdfStream,
} from '../../core/pdfObjects.js';
import {
  decodeStream,
  getStreamFilters,
} from '../../parser/streamDecode.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Information about a single image XObject in a PDF document.
 */
export interface ImageInfo {
  /** The PdfStream object for this image (can be mutated for in-place optimization). */
  readonly stream: PdfStream;
  /** The indirect reference to this stream in the registry. */
  readonly ref: PdfRef;
  /** Resource name on the page (e.g. '/Im1'). */
  readonly name: string;
  /** Zero-based page index where this image appears. */
  readonly pageIndex: number;
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Bits per component (typically 8). */
  readonly bitsPerComponent: number;
  /** PDF color space name (e.g. 'DeviceRGB', 'DeviceGray', 'DeviceCMYK'). */
  readonly colorSpace: string;
  /** Number of color channels (1, 3, or 4). */
  readonly channels: number;
  /** PDF filter name(s) applied to this stream. */
  readonly filters: readonly string[];
  /** Size of the compressed stream data in bytes. */
  readonly compressedSize: number;
}

// ---------------------------------------------------------------------------
// Color space helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the color space name from a `/ColorSpace` entry.
 * Handles both simple names (`/DeviceRGB`) and array forms
 * (`[/ICCBased ...]`, `[/Indexed /DeviceRGB ...]`).
 * @internal
 */
function resolveColorSpace(
  csEntry: PdfName | PdfArray | PdfRef | undefined,
  registry: { resolve(ref: PdfRef): import('../../core/pdfObjects.js').PdfObject | undefined },
): string {
  if (!csEntry) return 'DeviceRGB';

  // Resolve indirect reference
  if (csEntry.kind === 'ref') {
    const resolved = registry.resolve(csEntry as PdfRef);
    if (!resolved) return 'DeviceRGB';
    return resolveColorSpace(
      resolved as PdfName | PdfArray,
      registry,
    );
  }

  // Simple name: /DeviceRGB, /DeviceGray, /DeviceCMYK
  if (csEntry.kind === 'name') {
    return (csEntry as PdfName).value.replace(/^\//, '');
  }

  // Array form: [/ICCBased stream] or [/Indexed base hival lookup]
  if (csEntry.kind === 'array') {
    const arr = csEntry as PdfArray;
    const first = arr.items[0];
    if (first && first.kind === 'name') {
      const csName = (first as PdfName).value.replace(/^\//, '');
      if (csName === 'ICCBased') {
        // ICCBased: determine channels from the ICC profile stream's /N entry
        const profileRef = arr.items[1];
        if (profileRef && profileRef.kind === 'ref') {
          const profile = registry.resolve(profileRef as PdfRef);
          if (profile && profile.kind === 'stream') {
            const n = (profile as PdfStream).dict.get('/N');
            if (n && n.kind === 'number') {
              const channels = (n as PdfNumber).value;
              if (channels === 1) return 'DeviceGray';
              if (channels === 3) return 'DeviceRGB';
              if (channels === 4) return 'DeviceCMYK';
            }
          }
        }
        return 'DeviceRGB'; // fallback
      }
      if (csName === 'Indexed') {
        // Indexed color space — base color space is at index 1
        return 'Indexed';
      }
      return csName;
    }
  }

  return 'DeviceRGB';
}

/**
 * Determine the number of channels from a color space name.
 * @internal
 */
function channelsFromColorSpace(colorSpace: string): number {
  switch (colorSpace) {
    case 'DeviceGray':
    case 'CalGray':
      return 1;
    case 'DeviceCMYK':
      return 4;
    case 'Indexed':
      return 1; // indexed uses 1 byte per pixel (palette index)
    case 'DeviceRGB':
    case 'CalRGB':
    case 'Lab':
    default:
      return 3;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract all image XObjects from a PDF document.
 *
 * Walks every page's `/Resources /XObject` dictionary and collects
 * metadata for each image XObject found.
 *
 * @param doc - A parsed `PdfDocument`.
 * @returns An array of `ImageInfo` objects, one per image XObject.
 *
 * @example
 * ```ts
 * import { loadPdf, extractImages } from 'modern-pdf-lib';
 *
 * const doc = await loadPdf(pdfBytes);
 * const images = extractImages(doc);
 *
 * for (const img of images) {
 *   console.log(`${img.name}: ${img.width}x${img.height} ${img.colorSpace} (${img.compressedSize} bytes)`);
 * }
 * ```
 */
export function extractImages(doc: PdfDocument): ImageInfo[] {
  const images: ImageInfo[] = [];
  const seenRefs = new Set<number>(); // deduplicate by object number
  const pages = doc.getPages();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex]!;
    const resources = page.getOriginalResources();
    if (!resources) continue;

    // Get the /XObject sub-dictionary
    let xObjDict: PdfDict | undefined;
    const xObjEntry = resources.get('/XObject');

    if (!xObjEntry) continue;

    if (xObjEntry.kind === 'dict') {
      xObjDict = xObjEntry as PdfDict;
    } else if (xObjEntry.kind === 'ref') {
      const resolved = page.getRegistry().resolve(xObjEntry as PdfRef);
      if (resolved && resolved.kind === 'dict') {
        xObjDict = resolved as PdfDict;
      }
    }

    if (!xObjDict) continue;

    const registry = page.getRegistry();

    // Iterate all XObject entries
    for (const [name, value] of xObjDict) {
      // Resolve the indirect reference
      let ref: PdfRef | undefined;
      let stream: PdfStream | undefined;

      if (value.kind === 'ref') {
        ref = value as PdfRef;

        // Skip if we've already seen this object
        if (seenRefs.has(ref.objectNumber)) continue;

        const resolved = registry.resolve(ref);
        if (resolved && resolved.kind === 'stream') {
          stream = resolved as PdfStream;
        }
      } else if (value.kind === 'stream') {
        stream = value as PdfStream;
      }

      if (!stream || !ref) continue;

      // Check it's an image XObject (not a Form XObject)
      const subtype = stream.dict.get('/Subtype');
      if (!subtype || subtype.kind !== 'name') continue;
      if ((subtype as PdfName).value !== '/Image') continue;

      // Read image metadata
      const widthObj = stream.dict.get('/Width');
      const heightObj = stream.dict.get('/Height');
      const bpcObj = stream.dict.get('/BitsPerComponent');

      const width = widthObj && widthObj.kind === 'number'
        ? (widthObj as PdfNumber).value : 0;
      const height = heightObj && heightObj.kind === 'number'
        ? (heightObj as PdfNumber).value : 0;
      const bitsPerComponent = bpcObj && bpcObj.kind === 'number'
        ? (bpcObj as PdfNumber).value : 8;

      // Resolve color space
      const csEntry = stream.dict.get('/ColorSpace') as
        | PdfName
        | PdfArray
        | PdfRef
        | undefined;
      const colorSpace = resolveColorSpace(csEntry, registry);
      const channels = channelsFromColorSpace(colorSpace);

      // Get filters
      const { filters } = getStreamFilters(stream.dict);

      seenRefs.add(ref.objectNumber);

      images.push({
        stream,
        ref,
        name,
        pageIndex,
        width,
        height,
        bitsPerComponent,
        colorSpace,
        channels,
        filters,
        compressedSize: stream.data.length,
      });
    }
  }

  return images;
}

/**
 * Decode image stream data into raw pixels.
 *
 * For DCTDecode (JPEG) streams, returns the raw JPEG bytes (not decoded
 * to pixels) since JPEG decoding requires the WASM module.
 *
 * For FlateDecode and other filters, fully decodes the stream.
 *
 * @param imageInfo - An `ImageInfo` from `extractImages()`.
 * @returns The decoded stream data.
 */
export function decodeImageStream(imageInfo: ImageInfo): Uint8Array {
  if (imageInfo.filters.length === 0) {
    return imageInfo.stream.data;
  }

  return decodeStream(
    imageInfo.stream.data,
    imageInfo.filters as string[],
    null,
  );
}
