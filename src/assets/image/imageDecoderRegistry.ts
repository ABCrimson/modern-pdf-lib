/**
 * @module assets/image/imageDecoderRegistry
 *
 * Pluggable image-decoder registry + dispatch.
 *
 * The library bundles decoders for PNG, JPEG, WebP, and TIFF
 * (see {@link module:assets/image/formatDetect}). It deliberately does **not**
 * bundle decoders for the modern next-generation codecs — AVIF, HEIC/HEIF, and
 * JPEG XL — because each requires a substantial, separately-maintained codec
 * (AV1 / HEVC intra / the JPEG XL reference codec) that is out of scope for a
 * pure-JS PDF library.
 *
 * This module provides the **honest integration path**: it lets a consumer
 * register a decoder they supply (typically a WASM build of `libaom`/`dav1d`,
 * `libheif`, or `libjxl`, or the browser's `ImageDecoder` Web API) under a
 * format key, and then dispatch raw bytes to it.
 *
 * IMPORTANT — this module performs **NO image decoding whatsoever**. It does not
 * parse AVIF/HEIC/JXL containers, it does not understand any bitstream, and it
 * makes no claim about any pixel data. It is *purely* a registry (a `Map`) plus
 * a dispatch function that validates the **shape** of whatever a registered
 * decoder returns. All real decoding is the responsibility of the
 * consumer-supplied {@link ImageDecoder}.
 *
 * Format keys are normalized (trimmed + lowercased), so `'AVIF'`, `' avif '`,
 * and `'avif'` all refer to the same decoder. Suggested keys: `'avif'`,
 * `'heic'`, `'jpegxl'`.
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A decoded raster image in tightly-packed, top-to-bottom, left-to-right
 * RGBA8888 form.
 *
 * - `width`  — image width in pixels (a positive integer).
 * - `height` — image height in pixels (a positive integer).
 * - `rgba`   — pixel data; exactly `width * height * 4` bytes, four bytes
 *              (red, green, blue, alpha) per pixel, each in the range `0..255`.
 */
export interface DecodedRasterImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/**
 * A consumer-supplied decoder: it takes the raw, encoded image bytes and
 * returns (synchronously or asynchronously) a {@link DecodedRasterImage}.
 *
 * The registry never inspects the input bytes; it forwards them verbatim to the
 * decoder. The decoder is solely responsible for parsing the container/bitstream
 * and producing valid RGBA8888 output.
 */
export type ImageDecoder = (
  bytes: Uint8Array,
) => DecodedRasterImage | Promise<DecodedRasterImage>;

// ---------------------------------------------------------------------------
// Module-level registry
// ---------------------------------------------------------------------------

/**
 * The single, module-scoped decoder registry, keyed by normalized format name.
 */
const registry = new Map<string, ImageDecoder>();

/**
 * Normalize a format key: trim surrounding whitespace and lowercase it, so that
 * `'AVIF'`, `' avif '`, and `'avif'` all map to the same entry.
 *
 * @param format  The caller-supplied format key.
 * @returns       The normalized key.
 */
function normalizeFormat(format: string): string {
  return format.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Public API — registration
// ---------------------------------------------------------------------------

/**
 * Register a decoder for a given image format.
 *
 * If a decoder is already registered for the (normalized) format, it is
 * replaced.
 *
 * @param format   Format key, e.g. `'avif'`, `'heic'`, `'jpegxl'`. The key is
 *                 normalized (trimmed + lowercased) before storage.
 * @param decoder  The {@link ImageDecoder} that turns encoded bytes into RGBA.
 */
export function registerImageDecoder(
  format: string,
  decoder: ImageDecoder,
): void {
  registry.set(normalizeFormat(format), decoder);
}

/**
 * Remove the decoder registered for a given format, if any.
 *
 * This is a no-op when no decoder is registered for the (normalized) format.
 *
 * @param format  Format key; normalized (trimmed + lowercased) before lookup.
 */
export function unregisterImageDecoder(format: string): void {
  registry.delete(normalizeFormat(format));
}

/**
 * Report whether a decoder is currently registered for a given format.
 *
 * @param format  Format key; normalized (trimmed + lowercased) before lookup.
 * @returns       `true` if a decoder is registered, otherwise `false`.
 */
export function hasImageDecoder(format: string): boolean {
  return registry.has(normalizeFormat(format));
}

/**
 * Get the decoder registered for a given format, if any.
 *
 * @param format  Format key; normalized (trimmed + lowercased) before lookup.
 * @returns       The registered {@link ImageDecoder}, or `undefined` if none.
 */
export function getImageDecoder(format: string): ImageDecoder | undefined {
  return registry.get(normalizeFormat(format));
}

// ---------------------------------------------------------------------------
// Public API — dispatch
// ---------------------------------------------------------------------------

/**
 * Validate that a value returned by a decoder is a well-formed
 * {@link DecodedRasterImage}.
 *
 * Throws a descriptive error (naming the format) if the result is malformed:
 * not an object, non-positive-integer dimensions, a non-`Uint8Array` `rgba`, or
 * an `rgba` length that does not equal `width * height * 4`.
 *
 * @param format  Normalized format key, used only for error messages.
 * @param result  The value returned by the decoder.
 * @returns       The same value, narrowed to {@link DecodedRasterImage}.
 */
function validateDecodedResult(
  format: string,
  result: unknown,
): DecodedRasterImage {
  if (result === null || typeof result !== 'object') {
    throw new Error(
      `Image decoder for format "${format}" returned a malformed result: ` +
        `expected an object with { width, height, rgba }, got ${typeof result}.`,
    );
  }

  const { width, height, rgba } = result as Record<string, unknown>;

  if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) {
    throw new Error(
      `Image decoder for format "${format}" returned a malformed result: ` +
        `width must be a positive integer, got ${String(width)}.`,
    );
  }

  if (typeof height !== 'number' || !Number.isInteger(height) || height <= 0) {
    throw new Error(
      `Image decoder for format "${format}" returned a malformed result: ` +
        `height must be a positive integer, got ${String(height)}.`,
    );
  }

  if (!(rgba instanceof Uint8Array)) {
    throw new Error(
      `Image decoder for format "${format}" returned a malformed result: ` +
        `rgba must be a Uint8Array, got ${
          rgba === null ? 'null' : typeof rgba
        }.`,
    );
  }

  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(
      `Image decoder for format "${format}" returned a malformed result: ` +
        `rgba length ${rgba.length} does not match width*height*4 = ` +
        `${width}*${height}*4 = ${expected}.`,
    );
  }

  return { width, height, rgba };
}

/**
 * Decode raw image bytes using a previously-registered decoder for `format`.
 *
 * Looks up the decoder by (normalized) format key, awaits its result, validates
 * the result shape (`rgba.length === width * height * 4`, positive-integer
 * dimensions, `Uint8Array` pixel buffer), and returns it.
 *
 * This function does **not** decode anything itself — it dispatches to the
 * consumer-supplied {@link ImageDecoder}. If no decoder is registered for the
 * format, it throws an error naming the format and explaining how to register
 * one via {@link registerImageDecoder}.
 *
 * @param format  Format key, e.g. `'avif'`; normalized before lookup.
 * @param bytes   Raw, encoded image bytes, forwarded verbatim to the decoder.
 * @returns       A validated {@link DecodedRasterImage}.
 * @throws        If no decoder is registered for the format, or if the
 *                registered decoder returns a malformed result.
 */
export async function decodeRegisteredImage(
  format: string,
  bytes: Uint8Array,
): Promise<DecodedRasterImage> {
  const normalized = normalizeFormat(format);
  const decoder = registry.get(normalized);

  if (decoder === undefined) {
    throw new Error(
      `No image decoder registered for format "${normalized}". ` +
        `This library does not bundle a decoder for this format; supply one ` +
        `with registerImageDecoder(${JSON.stringify(normalized)}, decoder), ` +
        `where decoder turns the encoded bytes into RGBA8888 ` +
        `({ width, height, rgba }).`,
    );
  }

  const result = await decoder(bytes);
  return validateDecodedResult(normalized, result);
}
