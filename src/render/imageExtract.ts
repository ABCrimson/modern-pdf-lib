/**
 * @module render/imageExtract
 *
 * Page-level image extraction.  Walks a {@link PdfPage}'s `/Resources`
 * `/XObject` dictionary, decodes every image XObject to raw interleaved
 * 8-bit pixels, and composites a soft mask (`/SMask`) into an alpha
 * channel when one is present.
 *
 * Unlike the document-level metadata walk in
 * `assets/image/imageExtract.ts`, this module returns ready-to-use pixel
 * buffers (RGBA / RGB / grayscale) so callers can rasterize, re-encode, or
 * inspect the actual image content.
 *
 * Supported decode paths:
 * - `DCTDecode` (JPEG) → {@link decodeJpegWasm} (requires the JPEG WASM
 *   module to be initialized; skipped gracefully otherwise).
 * - `FlateDecode` / raw (no filter) → {@link decodeStreamData}, then
 *   interpreted by `/ColorSpace` (`/DeviceRGB`, `/DeviceGray`,
 *   `/DeviceCMYK`, `/Indexed`) and `/BitsPerComponent`.
 *
 * Unsupported or malformed images are skipped — this function never throws.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

import type { PdfPage } from '../core/pdfPage.js';
import type { PdfObject } from '../core/pdfObjects.js';
import {
  PdfArray,
  PdfDict,
  PdfName,
  PdfNumber,
  PdfRef,
  PdfStream,
  PdfString,
  PdfObjectRegistry,
} from '../core/pdfObjects.js';
import { decodeStreamData, getStreamFilters } from '../parser/streamDecode.js';
import { cmykToRgb } from '../core/operators/color.js';
import { decodeJpegWasm } from '../wasm/jpeg/bridge.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * A single decoded image extracted from a page's XObject resources.
 *
 * `pixels` is interleaved, row-major, 8-bit data:
 * - RGBA (4 channels) when {@link hasAlpha} is `true`,
 * - RGB (3 channels) for colour images without alpha,
 * - grayscale (1 channel) for `/DeviceGray` images without alpha.
 */
export interface ExtractedImage {
  /** Resource name of the image XObject (without the leading slash, e.g. `Im1`). */
  name: string;
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Number of interleaved channels in {@link pixels} (1, 3, or 4). */
  channels: number;
  /** Interleaved 8-bit pixel data (RGBA, RGB, or grayscale). */
  pixels: Uint8Array;
  /** Resolved colour-space name (e.g. `DeviceRGB`, `DeviceGray`, `DeviceCMYK`, `Indexed`). */
  colorSpace: string;
  /** Bits per component of the source samples (typically `8`). */
  bitsPerComponent: number;
  /** Whether {@link pixels} includes an alpha channel (4-channel RGBA). */
  hasAlpha: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract and decode all image XObjects referenced by a page.
 *
 * @param page - The page whose `/Resources /XObject` images are extracted.
 * @returns One {@link ExtractedImage} per successfully decoded image XObject.
 *          Images that cannot be decoded (unsupported filters/colour spaces,
 *          missing WASM, malformed data) are skipped silently.
 *
 * @example
 * ```ts
 * import { loadPdf } from 'modern-pdf-lib';
 * import { extractImages } from 'modern-pdf-lib/render';
 *
 * const doc = await loadPdf(bytes);
 * for (const img of extractImages(doc.getPage(0))) {
 *   console.log(img.name, img.width, img.height, img.channels, img.hasAlpha);
 * }
 * ```
 */
export function extractImages(page: PdfPage): ExtractedImage[] {
  const out: ExtractedImage[] = [];

  const resources = page.getOriginalResources();
  if (!resources) return out;

  const registry = page.getRegistry();

  const xObjDict = resolveDict(resources.get('/XObject'), registry);
  if (!xObjDict) return out;

  for (const [name, value] of xObjDict) {
    const stream = resolveStream(value, registry);
    if (!stream) continue;

    // Image XObjects only (skip Form XObjects, etc.).
    const subtype = stream.dict.get('/Subtype');
    if (!(subtype instanceof PdfName) || subtype.value !== '/Image') continue;

    try {
      const extracted = decodeImage(name, stream, registry);
      if (extracted) out.push(extracted);
    } catch {
      // Skip unsupported / malformed images gracefully.
      continue;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Image decoding
// ---------------------------------------------------------------------------

/**
 * Decode a single image XObject stream to interleaved 8-bit pixels and
 * composite any soft mask.  Returns `undefined` when the image cannot be
 * decoded (e.g. JPEG WASM unavailable, unsupported colour space).
 * @internal
 */
function decodeImage(
  name: string,
  stream: PdfStream,
  registry: PdfObjectRegistry,
): ExtractedImage | undefined {
  const width = readInt(stream.dict.get('/Width'), 0);
  const height = readInt(stream.dict.get('/Height'), 0);
  if (width <= 0 || height <= 0) return undefined;

  const bitsPerComponent = readInt(stream.dict.get('/BitsPerComponent'), 8);

  // Resolve the colour space (handles ICCBased, Indexed, CalRGB, etc.).
  const cs = resolveColorSpace(stream.dict.get('/ColorSpace'), registry);

  const { filters } = getStreamFilters(stream.dict);
  const isJpeg = filters.includes('DCTDecode');

  // --- Base colour pixels (RGB / Gray) ---------------------------------
  let base: { pixels: Uint8Array; channels: number } | undefined;

  if (isJpeg) {
    base = decodeJpegBase(stream, width, height);
  } else {
    // FlateDecode / LZW / raw — decodeStreamData applies declared filters.
    const raw = decodeStreamData(stream);
    base = interpretSamples(raw, width, height, bitsPerComponent, cs);
  }

  if (!base) return undefined;

  // --- Soft mask → alpha channel ---------------------------------------
  const alpha = extractSoftMask(stream, registry, width, height);

  if (alpha) {
    const pixels = compositeAlpha(base.pixels, base.channels, width, height, alpha);
    return {
      name: stripSlash(name),
      width,
      height,
      channels: 4,
      pixels,
      colorSpace: cs.name,
      bitsPerComponent,
      hasAlpha: true,
    };
  }

  return {
    name: stripSlash(name),
    width,
    height,
    channels: base.channels,
    pixels: base.pixels,
    colorSpace: cs.name,
    bitsPerComponent,
    hasAlpha: false,
  };
}

/**
 * Decode a DCTDecode (JPEG) image XObject to interleaved 8-bit pixels.
 *
 * `decodeStreamData` passes DCTDecode through unchanged (decoding any outer
 * filters such as an ASCII85 wrapper first), so the result is the raw JPEG
 * byte stream handed to the WASM decoder.
 * @internal
 */
function decodeJpegBase(
  stream: PdfStream,
  width: number,
  height: number,
): { pixels: Uint8Array; channels: number } | undefined {
  const jpegBytes = decodeStreamData(stream);
  const decoded = decodeJpegWasm(jpegBytes);
  if (!decoded) return undefined; // WASM unavailable or decode failed.

  // Trust the JPEG decoder's own dimensions when they disagree with the
  // dictionary (rare), but only keep the image if the buffer is consistent.
  const w = decoded.width || width;
  const h = decoded.height || height;
  const channels = decoded.channels;
  if (w <= 0 || h <= 0 || channels <= 0) return undefined;
  if (decoded.pixels.length < w * h * channels) return undefined;

  return { pixels: decoded.pixels, channels };
}

// ---------------------------------------------------------------------------
// Sample interpretation (FlateDecode / raw)
// ---------------------------------------------------------------------------

/** A resolved colour space with its rendering parameters. @internal */
interface ResolvedColorSpace {
  /** Canonical name (e.g. `DeviceRGB`, `DeviceGray`, `DeviceCMYK`, `Indexed`). */
  name: string;
  /** Number of colour components consumed per pixel sample in the source data. */
  components: number;
  /** Palette bytes for `Indexed` spaces (RGB triples), else `undefined`. */
  palette?: Uint8Array | undefined;
}

/**
 * Interpret decoded sample bytes as interleaved 8-bit RGB / grayscale
 * pixels according to the colour space and bits-per-component.
 * @internal
 */
function interpretSamples(
  data: Uint8Array,
  width: number,
  height: number,
  bpc: number,
  cs: ResolvedColorSpace,
): { pixels: Uint8Array; channels: number } | undefined {
  const pixelCount = width * height;

  // Indexed: each sample is a palette index → expand to RGB.
  if (cs.name === 'Indexed' && cs.palette) {
    return expandIndexed(data, width, height, bpc, cs.palette);
  }

  // For non-indexed spaces, normalize samples to 8-bit per component.
  const components = cs.components;
  const samples = readComponentSamples(data, pixelCount * components, bpc);
  if (!samples) return undefined;

  if (cs.name === 'DeviceGray' || cs.name === 'CalGray') {
    // Grayscale — one channel, already 8-bit.
    const pixels = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) pixels[i] = samples[i] ?? 0;
    return { pixels, channels: 1 };
  }

  if (cs.name === 'DeviceCMYK') {
    // Convert each CMYK sample to RGB.
    const pixels = new Uint8Array(pixelCount * 3);
    for (let p = 0; p < pixelCount; p++) {
      const si = p * 4;
      const c = (samples[si] ?? 0) / 255;
      const m = (samples[si + 1] ?? 0) / 255;
      const y = (samples[si + 2] ?? 0) / 255;
      const k = (samples[si + 3] ?? 0) / 255;
      const [r, g, b] = cmykToRgb(c, m, y, k);
      const di = p * 3;
      pixels[di] = Math.round(r * 255);
      pixels[di + 1] = Math.round(g * 255);
      pixels[di + 2] = Math.round(b * 255);
    }
    return { pixels, channels: 3 };
  }

  // DeviceRGB / CalRGB / Lab / fallback → 3-channel RGB.
  const pixels = new Uint8Array(pixelCount * 3);
  for (let i = 0; i < pixelCount * 3; i++) pixels[i] = samples[i] ?? 0;
  return { pixels, channels: 3 };
}

/**
 * Expand an indexed (palette) image to interleaved RGB pixels.
 * @internal
 */
function expandIndexed(
  data: Uint8Array,
  width: number,
  height: number,
  bpc: number,
  palette: Uint8Array,
): { pixels: Uint8Array; channels: number } {
  const pixelCount = width * height;
  const pixels = new Uint8Array(pixelCount * 3);
  const maxIndex = Math.floor(palette.length / 3) - 1;

  const indices = readPackedRows(data, width, height, 1, bpc);

  for (let p = 0; p < pixelCount; p++) {
    let idx = indices[p] ?? 0;
    if (idx > maxIndex) idx = maxIndex < 0 ? 0 : maxIndex;
    const pi = idx * 3;
    const di = p * 3;
    pixels[di] = palette[pi] ?? 0;
    pixels[di + 1] = palette[pi + 1] ?? 0;
    pixels[di + 2] = palette[pi + 2] ?? 0;
  }

  return { pixels, channels: 3 };
}

/**
 * Read `count` component samples, normalizing sub-byte / 16-bit components
 * to 8-bit values.  Returns `undefined` when the buffer is too small.
 * @internal
 */
function readComponentSamples(
  data: Uint8Array,
  count: number,
  bpc: number,
): Uint8Array | undefined {
  if (bpc === 8) {
    if (data.length < count) return undefined;
    return data.subarray(0, count);
  }

  if (bpc === 16) {
    if (data.length < count * 2) return undefined;
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i++) out[i] = data[i * 2] ?? 0; // high byte ≈ /256
    return out;
  }

  // Sub-byte (1, 2, 4) — unpack bit fields and scale to 0..255.
  if (bpc === 1 || bpc === 2 || bpc === 4) {
    const out = new Uint8Array(count);
    const max = (1 << bpc) - 1;
    let bitPos = 0;
    for (let i = 0; i < count; i++) {
      const byteIdx = bitPos >>> 3;
      if (byteIdx >= data.length) return undefined;
      const bitOff = bitPos & 7;
      const shift = 8 - bitOff - bpc;
      const val = (data[byteIdx]! >> shift) & max;
      out[i] = Math.round((val / max) * 255);
      bitPos += bpc;
    }
    return out;
  }

  return undefined;
}

/**
 * Read packed single-component rows (e.g. indexed indices) honouring PDF
 * row-byte alignment (each scanline starts on a byte boundary).
 * @internal
 */
function readPackedRows(
  data: Uint8Array,
  width: number,
  height: number,
  components: number,
  bpc: number,
): Uint8Array {
  const out = new Uint8Array(width * height * components);
  const rowBits = width * components * bpc;
  const rowBytes = Math.ceil(rowBits / 8);
  const max = (1 << bpc) - 1;

  for (let row = 0; row < height; row++) {
    const rowStart = row * rowBytes;
    let bitPos = 0;
    for (let col = 0; col < width * components; col++) {
      const byteIdx = rowStart + (bitPos >>> 3);
      let val = 0;
      if (byteIdx < data.length) {
        if (bpc === 8) {
          val = data[byteIdx]!;
        } else if (bpc === 16) {
          val = data[byteIdx]!;
        } else {
          const bitOff = bitPos & 7;
          const shift = 8 - bitOff - bpc;
          val = (data[byteIdx]! >> shift) & max;
        }
      }
      out[row * width * components + col] = val;
      bitPos += bpc;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Soft mask
// ---------------------------------------------------------------------------

/**
 * Resolve and decode the `/SMask` of an image to a per-pixel 8-bit alpha
 * buffer sized `width * height`, nearest-sampling when the mask resolution
 * differs from the base image.  Returns `undefined` when no usable mask is
 * present.
 * @internal
 */
function extractSoftMask(
  stream: PdfStream,
  registry: PdfObjectRegistry,
  width: number,
  height: number,
): Uint8Array | undefined {
  const smask = resolveStream(stream.dict.get('/SMask'), registry);
  if (!smask) return undefined;

  const mw = readInt(smask.dict.get('/Width'), 0);
  const mh = readInt(smask.dict.get('/Height'), 0);
  if (mw <= 0 || mh <= 0) return undefined;

  const mbpc = readInt(smask.dict.get('/BitsPerComponent'), 8);

  // A soft mask is a single-channel (DeviceGray) image.
  let maskData: Uint8Array;
  const { filters } = getStreamFilters(smask.dict);
  if (filters.includes('DCTDecode')) {
    const decoded = decodeJpegWasm(decodeStreamData(smask));
    if (!decoded) return undefined;
    maskData = decoded.pixels;
  } else {
    const raw = decodeStreamData(smask);
    const samples = readComponentSamples(raw, mw * mh, mbpc);
    if (!samples) {
      // Try row-aligned unpack as a last resort.
      maskData = readPackedRows(raw, mw, mh, 1, mbpc);
    } else {
      maskData = samples;
    }
  }

  if (maskData.length < mw * mh) return undefined;

  // Same size → use directly.
  if (mw === width && mh === height) {
    return maskData.subarray(0, width * height);
  }

  // Different size → nearest-neighbour resample to the base dimensions.
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(mh - 1, Math.floor((y * mh) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(mw - 1, Math.floor((x * mw) / width));
      alpha[y * width + x] = maskData[sy * mw + sx] ?? 255;
    }
  }
  return alpha;
}

/**
 * Composite a base colour buffer with an alpha channel into interleaved
 * RGBA pixels.  A grayscale base is promoted to RGB first.
 * @internal
 */
function compositeAlpha(
  base: Uint8Array,
  channels: number,
  width: number,
  height: number,
  alpha: Uint8Array,
): Uint8Array {
  const pixelCount = width * height;
  const out = new Uint8Array(pixelCount * 4);

  for (let p = 0; p < pixelCount; p++) {
    const di = p * 4;
    if (channels === 1) {
      const g = base[p] ?? 0;
      out[di] = g;
      out[di + 1] = g;
      out[di + 2] = g;
    } else {
      const si = p * channels;
      out[di] = base[si] ?? 0;
      out[di + 1] = base[si + 1] ?? 0;
      out[di + 2] = base[si + 2] ?? 0;
    }
    out[di + 3] = alpha[p] ?? 255;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Colour-space resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a `/ColorSpace` entry into a canonical name, component count, and
 * (for indexed spaces) the palette bytes.
 * @internal
 */
function resolveColorSpace(
  entry: PdfObject | undefined,
  registry: PdfObjectRegistry,
): ResolvedColorSpace {
  const resolved = deref(entry, registry);

  if (resolved instanceof PdfName) {
    return nameToColorSpace(resolved.value);
  }

  if (resolved instanceof PdfArray) {
    const first = deref(resolved.items[0], registry);
    if (first instanceof PdfName) {
      const head = stripSlash(first.value);

      if (head === 'ICCBased') {
        const profile = resolveStream(resolved.items[1], registry);
        const n = profile ? readInt(profile.dict.get('/N'), 3) : 3;
        if (n === 1) return { name: 'DeviceGray', components: 1 };
        if (n === 4) return { name: 'DeviceCMYK', components: 4 };
        return { name: 'DeviceRGB', components: 3 };
      }

      if (head === 'Indexed' || head === 'I') {
        const palette = readIndexedPalette(resolved, registry);
        return { name: 'Indexed', components: 1, palette };
      }

      if (head === 'CalRGB' || head === 'Lab') {
        return { name: head, components: 3 };
      }
      if (head === 'CalGray') {
        return { name: 'CalGray', components: 1 };
      }

      return nameToColorSpace(first.value);
    }
  }

  // Unknown → assume RGB.
  return { name: 'DeviceRGB', components: 3 };
}

/** Map a colour-space name to its canonical form + component count. @internal */
function nameToColorSpace(rawName: string): ResolvedColorSpace {
  const name = stripSlash(rawName);
  switch (name) {
    case 'DeviceGray':
    case 'G':
    case 'CalGray':
      return { name: 'DeviceGray', components: 1 };
    case 'DeviceCMYK':
    case 'CMYK':
      return { name: 'DeviceCMYK', components: 4 };
    case 'DeviceRGB':
    case 'RGB':
    case 'CalRGB':
      return { name: 'DeviceRGB', components: 3 };
    default:
      return { name: 'DeviceRGB', components: 3 };
  }
}

/**
 * Read the lookup table (palette) from an `[/Indexed base hival lookup]`
 * colour-space array.  The lookup table may be a hex/literal string or a
 * stream.
 * @internal
 */
function readIndexedPalette(
  arr: PdfArray,
  registry: PdfObjectRegistry,
): Uint8Array | undefined {
  const lookup = deref(arr.items[3], registry);

  if (lookup instanceof PdfString) {
    // Parsed hex/literal strings store one byte per char code (latin1).
    const value = lookup.value;
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff;
    return bytes;
  }

  if (lookup instanceof PdfStream) {
    return decodeStreamData(lookup);
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Object-resolution helpers
// ---------------------------------------------------------------------------

/** Resolve a value to its target object, following one indirect reference. @internal */
function deref(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): PdfObject | undefined {
  if (obj instanceof PdfRef) return registry.resolve(obj);
  return obj;
}

/** Resolve a value (possibly a ref) to a `PdfDict`, or `undefined`. @internal */
function resolveDict(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): PdfDict | undefined {
  const resolved = deref(obj, registry);
  return resolved instanceof PdfDict ? resolved : undefined;
}

/** Resolve a value (possibly a ref) to a `PdfStream`, or `undefined`. @internal */
function resolveStream(
  obj: PdfObject | undefined,
  registry: PdfObjectRegistry,
): PdfStream | undefined {
  const resolved = deref(obj, registry);
  return resolved instanceof PdfStream ? resolved : undefined;
}

/** Read an integer from a PDF object, or fall back. @internal */
function readInt(obj: PdfObject | undefined, fallback: number): number {
  return obj instanceof PdfNumber ? Math.round(obj.value) : fallback;
}

/** Strip a single leading slash from a PDF name string. @internal */
function stripSlash(s: string): string {
  return s.startsWith('/') ? s.slice(1) : s;
}
