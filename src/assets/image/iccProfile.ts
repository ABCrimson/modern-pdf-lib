/**
 * @module assets/image/iccProfile
 *
 * ICC color profile extraction and preservation for PDF image XObjects.
 *
 * When images are recompressed during optimization, their ICC color
 * profiles can be stripped, causing color shifts in print workflows.
 * This module extracts ICC profiles from the original image's color
 * space entry and re-embeds them after recompression, preserving
 * color fidelity.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfRef,
  PdfStream,
} from '../../core/pdfObjects.js';
import type { PdfObjectRegistry } from '../../core/pdfObjects.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Represents an extracted ICC color profile.
 */
export interface IccProfile {
  /** Raw ICC profile data bytes. */
  readonly data: Uint8Array;
  /** Number of color components (1 = gray, 3 = RGB, 4 = CMYK). */
  readonly components: number;
  /** ICC color space signature (e.g. 'RGB ', 'CMYK', 'GRAY'). */
  readonly colorSpace: string;
  /** Human-readable profile description from the 'desc' tag, if present. */
  readonly description: string | undefined;
}

// ---------------------------------------------------------------------------
// ICC profile binary parsing helpers
// ---------------------------------------------------------------------------

/**
 * Known ICC color space signatures (4 bytes at offset 16 in the profile header).
 * @internal
 */
const ICC_COLOR_SPACE_MAP: Record<string, string> = {
  'RGB ': 'RGB',
  'CMYK': 'CMYK',
  'GRAY': 'GRAY',
  'Lab ': 'Lab',
  'XYZ ': 'XYZ',
  'Luv ': 'Luv',
  'YCbr': 'YCbCr',
  'Yxy ': 'Yxy',
  'HSV ': 'HSV',
  'HLS ': 'HLS',
};

/**
 * Read the color space signature from raw ICC profile data.
 *
 * The ICC profile header stores a 4-byte color space of data field
 * at byte offset 16. This function reads and decodes that signature
 * into a human-readable string.
 *
 * @param data - Raw ICC profile bytes.
 * @returns The color space name (e.g. `'RGB'`, `'CMYK'`, `'GRAY'`),
 *          or `'Unknown'` if the data is too short or the signature
 *          is not recognized.
 *
 * @example
 * ```ts
 * import { parseIccColorSpace } from 'modern-pdf-lib';
 *
 * const colorSpace = parseIccColorSpace(iccProfileBytes);
 * console.log(colorSpace); // 'RGB'
 * ```
 */
export function parseIccColorSpace(data: Uint8Array): string {
  // ICC header is at least 128 bytes; color space sig is at offset 16–19
  if (data.length < 20) return 'Unknown';

  const sig = String.fromCharCode(data[16]!, data[17]!, data[18]!, data[19]!);
  return ICC_COLOR_SPACE_MAP[sig] ?? 'Unknown';
}

/**
 * Parse the human-readable description from an ICC profile's 'desc' tag.
 *
 * Searches the ICC tag table for a tag with signature `'desc'`
 * (0x64657363) and reads the ASCII description string from it.
 *
 * The 'desc' tag (ICC v2) has the structure:
 * - Bytes 0–3: type signature ('desc')
 * - Bytes 4–7: reserved (0)
 * - Bytes 8–11: ASCII description length (uint32 BE)
 * - Bytes 12+: ASCII description string
 *
 * @param data - Raw ICC profile bytes.
 * @returns The description string, or `undefined` if the tag is not
 *          found or cannot be parsed.
 */
export function parseIccDescription(data: Uint8Array): string | undefined {
  // ICC header is 128 bytes. Tag count is at offset 128 (uint32 BE).
  if (data.length < 132) return undefined;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tagCount = view.getUint32(128, false);

  // Each tag table entry is 12 bytes starting at offset 132
  const tagTableStart = 132;
  if (data.length < tagTableStart + tagCount * 12) return undefined;

  for (let i = 0; i < tagCount; i++) {
    const entryOffset = tagTableStart + i * 12;
    const tagSig = view.getUint32(entryOffset, false);

    // 'desc' = 0x64657363
    if (tagSig !== 0x64657363) continue;

    const tagOffset = view.getUint32(entryOffset + 4, false);
    const tagSize = view.getUint32(entryOffset + 8, false);

    // Validate tag data fits within profile
    if (tagOffset + tagSize > data.length) return undefined;
    if (tagSize < 12) return undefined;

    // Read the type signature at the tag data offset
    // For 'desc' type, bytes 8–11 are the ASCII string length
    const descLen = view.getUint32(tagOffset + 8, false);
    if (descLen === 0) return undefined;

    // Read the ASCII string (null-terminated), starting at tagOffset + 12
    const strEnd = Math.min(tagOffset + 12 + descLen - 1, tagOffset + tagSize);
    if (strEnd <= tagOffset + 12) return undefined;

    const chars: string[] = [];
    for (let j = tagOffset + 12; j < strEnd; j++) {
      const c = data[j]!;
      if (c === 0) break; // null terminator
      chars.push(String.fromCharCode(c));
    }

    return chars.length > 0 ? chars.join('') : undefined;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// ICC profile extraction from PDF image streams
// ---------------------------------------------------------------------------

/**
 * Extract the ICC color profile from a PDF image XObject's `/ColorSpace`.
 *
 * Checks whether the image's `/ColorSpace` entry is an ICCBased array
 * (i.e. `[/ICCBased <stream ref>]`), and if so, extracts the raw ICC
 * profile bytes and metadata from the referenced stream.
 *
 * @param stream   - The `PdfStream` for the image XObject.
 * @param registry - The document's `PdfObjectRegistry` for resolving
 *                   indirect references.
 * @returns An `IccProfile` if the image uses an ICCBased color space,
 *          or `undefined` if no ICC profile is attached.
 *
 * @example
 * ```ts
 * import { extractIccProfile, extractImages, loadPdf } from 'modern-pdf-lib';
 *
 * const doc = await loadPdf(pdfBytes);
 * const images = extractImages(doc);
 *
 * for (const img of images) {
 *   const profile = extractIccProfile(img.stream, doc.getRegistry());
 *   if (profile) {
 *     console.log(`ICC: ${profile.colorSpace}, ${profile.components} channels`);
 *     console.log(`Description: ${profile.description ?? 'none'}`);
 *   }
 * }
 * ```
 */
export function extractIccProfile(
  stream: PdfStream,
  registry: PdfObjectRegistry,
): IccProfile | undefined {
  const csEntry = stream.dict.get('/ColorSpace');
  if (!csEntry) return undefined;

  // Resolve indirect reference on the color space itself
  let cs = csEntry;
  if (cs.kind === 'ref') {
    const resolved = registry.resolve(cs as PdfRef);
    if (!resolved) return undefined;
    cs = resolved;
  }

  // Must be an array: [/ICCBased <stream ref>]
  if (cs.kind !== 'array') return undefined;

  const arr = cs as PdfArray;
  if (arr.items.length < 2) return undefined;

  // First item must be /ICCBased
  const first = arr.items[0]!;
  if (first.kind !== 'name') return undefined;
  if ((first as PdfName).value !== '/ICCBased') return undefined;

  // Second item is the profile stream (or ref to it)
  let profileObj = arr.items[1]!;
  if (profileObj.kind === 'ref') {
    const resolved = registry.resolve(profileObj as PdfRef);
    if (!resolved) return undefined;
    profileObj = resolved;
  }

  if (profileObj.kind !== 'stream') return undefined;

  const profileStream = profileObj as PdfStream;
  const profileData = profileStream.data;

  // Read /N (number of components) from the profile stream's dictionary
  const nEntry = profileStream.dict.get('/N');
  const components =
    nEntry && nEntry.kind === 'number' ? (nEntry as PdfNumber).value : 0;

  if (components < 1 || components > 4) return undefined;

  // Parse ICC profile metadata
  const colorSpace = parseIccColorSpace(profileData);
  const description = parseIccDescription(profileData);

  return {
    data: profileData,
    components,
    colorSpace,
    description,
  };
}

// ---------------------------------------------------------------------------
// ICC profile embedding into PDF
// ---------------------------------------------------------------------------

/**
 * Embed an ICC color profile into the PDF object registry and return
 * a reference that can be used as a `/ColorSpace` entry.
 *
 * Creates a new `PdfStream` for the ICC profile data with the required
 * `/N` (number of components) entry, registers it, and returns a
 * `PdfRef` to the stream. The caller should then set the image's
 * `/ColorSpace` to `[/ICCBased <returned ref>]`.
 *
 * @param profile  - The `IccProfile` to embed.
 * @param registry - The document's `PdfObjectRegistry`.
 * @returns A `PdfRef` pointing to the newly created ICC profile stream.
 *
 * @example
 * ```ts
 * import { embedIccProfile, extractIccProfile } from 'modern-pdf-lib';
 *
 * const profile = extractIccProfile(imageStream, registry);
 * if (profile) {
 *   const profileRef = embedIccProfile(profile, registry);
 *   const colorSpace = PdfArray.of([PdfName.of('/ICCBased'), profileRef]);
 *   imageStream.dict.set('/ColorSpace', colorSpace);
 * }
 * ```
 */
export function embedIccProfile(
  profile: IccProfile,
  registry: PdfObjectRegistry,
): PdfRef {
  const dict = new PdfDict();
  dict.set('/N', PdfNumber.of(profile.components));
  dict.set('/Length', PdfNumber.of(profile.data.length));

  // Optionally set /Alternate to hint at the fallback color space
  if (profile.components === 1) {
    dict.set('/Alternate', PdfName.of('/DeviceGray'));
  } else if (profile.components === 3) {
    dict.set('/Alternate', PdfName.of('/DeviceRGB'));
  } else if (profile.components === 4) {
    dict.set('/Alternate', PdfName.of('/DeviceCMYK'));
  }

  const stream = new PdfStream(dict, profile.data);
  return registry.register(stream);
}
