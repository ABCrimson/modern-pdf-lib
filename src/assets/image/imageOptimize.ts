/**
 * @module assets/image/imageOptimize
 *
 * Optional image optimization — downsampling and recompression.
 *
 * These utilities are used to reduce the size of images before
 * embedding them in a PDF.  Both functions are optional and operate
 * on raw pixel data (not on encoded PNG/JPEG streams).
 *
 * All implementations are currently stubs with clear interfaces;
 * full implementations will follow.
 *
 * No Buffer — uses Uint8Array exclusively.
 * No fs — no file system access.
 * No require() — ESM import only.
 */

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Options for image downscaling.
 */
export interface DownscaleOptions {
  /** Target maximum width in pixels.  The image is scaled proportionally. */
  readonly maxWidth?: number;
  /** Target maximum height in pixels.  The image is scaled proportionally. */
  readonly maxHeight?: number;
  /**
   * Target DPI for the image at its intended print size.  If specified
   * along with `printWidth` / `printHeight`, the image is downscaled
   * to match the target DPI.
   *
   * For example, a 3000×2000 image printed at 10×6.67 inches would be
   * 300 DPI.  Setting `targetDpi: 150` would downscale to 1500×1000.
   */
  readonly targetDpi?: number;
  /**
   * Intended print width in points (1/72 inch).
   * Used together with `targetDpi` to compute the target pixel dimensions.
   */
  readonly printWidth?: number;
  /**
   * Intended print height in points (1/72 inch).
   * Used together with `targetDpi` to compute the target pixel dimensions.
   */
  readonly printHeight?: number;
  /**
   * Resampling algorithm.
   * - `'nearest'`: Nearest-neighbor (fast, blocky)
   * - `'bilinear'`: Bilinear interpolation (good quality, moderate speed)
   * - `'lanczos'`: Lanczos-3 resampling (best quality, slowest)
   *
   * Default: `'bilinear'`.
   */
  readonly algorithm?: 'nearest' | 'bilinear' | 'lanczos';
}

/**
 * Options for image recompression.
 */
export interface RecompressOptions {
  /**
   * Output format.
   * - `'jpeg'`: JPEG compression (lossy, good for photographs)
   * - `'deflate'`: Deflate/zlib compression (lossless, used in PDF FlateDecode)
   *
   * Default: `'deflate'`.
   */
  readonly format?: 'jpeg' | 'deflate';
  /**
   * JPEG quality (1–100).  Only used when `format` is `'jpeg'`.
   * Higher values produce larger files with better quality.
   *
   * Default: `85`.
   */
  readonly quality?: number;
  /**
   * Deflate compression level (1–9).  Only used when `format` is `'deflate'`.
   * Higher values produce smaller files but take longer.
   *
   * Default: `6`.
   */
  readonly compressionLevel?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

/**
 * Combined options for the full optimization pipeline.
 */
export interface ImageOptimizeOptions extends DownscaleOptions, RecompressOptions {
  /**
   * Skip optimization if the input data is already smaller than this
   * threshold (in bytes).
   *
   * Default: `0` (always optimize).
   */
  readonly skipBelowBytes?: number;
}

/**
 * Raw image pixel data with metadata.
 */
export interface RawImageData {
  /** Pixel data in row-major order, channel-interleaved. */
  readonly pixels: Uint8Array;
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /**
   * Number of channels:
   * - 1: Grayscale
   * - 2: Grayscale + Alpha
   * - 3: RGB
   * - 4: RGBA
   */
  readonly channels: 1 | 2 | 3 | 4;
  /** Bits per channel (typically 8). */
  readonly bitsPerChannel: number;
}

/**
 * The result of an optimization operation.
 */
export interface OptimizeResult {
  /** The optimized pixel data (or compressed data if recompressed). */
  readonly data: Uint8Array;
  /** Output width in pixels. */
  readonly width: number;
  /** Output height in pixels. */
  readonly height: number;
  /** Number of channels in the output. */
  readonly channels: number;
  /** The compression format applied, if any. */
  readonly format: 'raw' | 'jpeg' | 'deflate';
  /** Whether any actual optimization was performed. */
  readonly wasOptimized: boolean;
}

// ---------------------------------------------------------------------------
// Public API: downscaleImage
// ---------------------------------------------------------------------------

/**
 * Downscale an image to fit within the specified dimensions.
 *
 * If the image is already smaller than the target dimensions, it is
 * returned unchanged.
 *
 * @param image   - The raw image pixel data.
 * @param options - Downscaling options (target dimensions, algorithm).
 * @returns The downscaled image, or the original if no scaling needed.
 *
 * @example
 * ```ts
 * const result = downscaleImage(rawImage, {
 *   maxWidth: 1024,
 *   maxHeight: 768,
 *   algorithm: 'bilinear',
 * });
 * ```
 */
export function downscaleImage(
  image: RawImageData,
  options: DownscaleOptions = {},
): RawImageData {
  // Compute target dimensions
  const target = computeTargetDimensions(image.width, image.height, options);

  // No scaling needed
  if (target.width >= image.width && target.height >= image.height) {
    return image;
  }

  const algorithm = options.algorithm ?? 'bilinear';

  switch (algorithm) {
    case 'nearest':
      return resampleNearest(image, target.width, target.height);
    case 'bilinear':
      return resampleBilinear(image, target.width, target.height);
    case 'lanczos':
      return resampleLanczos(image, target.width, target.height);
    default:
      return resampleBilinear(image, target.width, target.height);
  }
}

// ---------------------------------------------------------------------------
// Public API: recompressImage
// ---------------------------------------------------------------------------

/**
 * Recompress raw image pixel data using the specified format.
 *
 * @param image   - The raw image pixel data.
 * @param options - Recompression options (format, quality).
 * @returns The compressed image data.
 *
 * @example
 * ```ts
 * const result = await recompressImage(rawImage, {
 *   format: 'deflate',
 *   compressionLevel: 9,
 * });
 * ```
 */
export async function recompressImage(
  image: RawImageData,
  options: RecompressOptions = {},
): Promise<OptimizeResult> {
  const format = options.format ?? 'deflate';

  switch (format) {
    case 'deflate':
      return recompressDeflate(image, options.compressionLevel ?? 6);
    case 'jpeg':
      return recompressJpeg(image, options.quality ?? 85);
    default:
      // Return raw data
      return {
        data: image.pixels,
        width: image.width,
        height: image.height,
        channels: image.channels,
        format: 'raw',
        wasOptimized: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Public API: optimizeImage (combined pipeline)
// ---------------------------------------------------------------------------

/**
 * Run the full image optimization pipeline: downscale then recompress.
 *
 * @param image   - The raw image pixel data.
 * @param options - Combined optimization options.
 * @returns The optimized result.
 */
export async function optimizeImage(
  image: RawImageData,
  options: ImageOptimizeOptions = {},
): Promise<OptimizeResult> {
  // Skip if below threshold
  if (options.skipBelowBytes && image.pixels.length < options.skipBelowBytes) {
    return {
      data: image.pixels,
      width: image.width,
      height: image.height,
      channels: image.channels,
      format: 'raw',
      wasOptimized: false,
    };
  }

  // Step 1: Downscale
  const downscaled = downscaleImage(image, options);

  // Step 2: Recompress
  return recompressImage(downscaled, options);
}

// ---------------------------------------------------------------------------
// Internal: target dimension computation
// ---------------------------------------------------------------------------

/**
 * Compute target dimensions from options, preserving aspect ratio.
 * @internal
 */
function computeTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  options: DownscaleOptions,
): { width: number; height: number } {
  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  // DPI-based scaling
  if (options.targetDpi && options.printWidth && options.printHeight) {
    const printWidthInches = options.printWidth / 72;
    const printHeightInches = options.printHeight / 72;
    const dpiWidth = Math.round(printWidthInches * options.targetDpi);
    const dpiHeight = Math.round(printHeightInches * options.targetDpi);

    targetWidth = Math.min(targetWidth, dpiWidth);
    targetHeight = Math.min(targetHeight, dpiHeight);
  }

  // Max dimension constraints
  if (options.maxWidth && targetWidth > options.maxWidth) {
    const scale = options.maxWidth / targetWidth;
    targetWidth = options.maxWidth;
    targetHeight = Math.round(targetHeight * scale);
  }

  if (options.maxHeight && targetHeight > options.maxHeight) {
    const scale = options.maxHeight / targetHeight;
    targetHeight = options.maxHeight;
    targetWidth = Math.round(targetWidth * scale);
  }

  // Ensure at least 1x1
  targetWidth = Math.max(1, targetWidth);
  targetHeight = Math.max(1, targetHeight);

  return { width: targetWidth, height: targetHeight };
}

// ---------------------------------------------------------------------------
// Internal: resampling implementations
// ---------------------------------------------------------------------------

/**
 * Nearest-neighbor resampling.
 * @internal
 */
function resampleNearest(
  src: RawImageData,
  dstWidth: number,
  dstHeight: number,
): RawImageData {
  const channels = src.channels;
  const dst = new Uint8Array(dstWidth * dstHeight * channels);

  const xRatio = src.width / dstWidth;
  const yRatio = src.height / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    const srcY = Math.min(Math.floor(y * yRatio), src.height - 1);
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.min(Math.floor(x * xRatio), src.width - 1);

      const srcIdx = (srcY * src.width + srcX) * channels;
      const dstIdx = (y * dstWidth + x) * channels;

      for (let c = 0; c < channels; c++) {
        dst[dstIdx + c] = src.pixels[srcIdx + c]!;
      }
    }
  }

  return {
    pixels: dst,
    width: dstWidth,
    height: dstHeight,
    channels,
    bitsPerChannel: src.bitsPerChannel,
  };
}

/**
 * Bilinear interpolation resampling.
 * @internal
 */
function resampleBilinear(
  src: RawImageData,
  dstWidth: number,
  dstHeight: number,
): RawImageData {
  const channels = src.channels;
  const dst = new Uint8Array(dstWidth * dstHeight * channels);

  const xRatio = (src.width - 1) / Math.max(1, dstWidth - 1);
  const yRatio = (src.height - 1) / Math.max(1, dstHeight - 1);

  for (let y = 0; y < dstHeight; y++) {
    const srcYf = y * yRatio;
    const srcY0 = Math.floor(srcYf);
    const srcY1 = Math.min(srcY0 + 1, src.height - 1);
    const yFrac = srcYf - srcY0;

    for (let x = 0; x < dstWidth; x++) {
      const srcXf = x * xRatio;
      const srcX0 = Math.floor(srcXf);
      const srcX1 = Math.min(srcX0 + 1, src.width - 1);
      const xFrac = srcXf - srcX0;

      const dstIdx = (y * dstWidth + x) * channels;

      for (let c = 0; c < channels; c++) {
        // Four source pixels
        const topLeft = src.pixels[(srcY0 * src.width + srcX0) * channels + c]!;
        const topRight = src.pixels[(srcY0 * src.width + srcX1) * channels + c]!;
        const bottomLeft = src.pixels[(srcY1 * src.width + srcX0) * channels + c]!;
        const bottomRight = src.pixels[(srcY1 * src.width + srcX1) * channels + c]!;

        // Bilinear interpolation
        const top = topLeft + (topRight - topLeft) * xFrac;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * xFrac;
        const value = top + (bottom - top) * yFrac;

        dst[dstIdx + c] = Math.round(Math.max(0, Math.min(255, value)));
      }
    }
  }

  return {
    pixels: dst,
    width: dstWidth,
    height: dstHeight,
    channels,
    bitsPerChannel: src.bitsPerChannel,
  };
}

/**
 * Lanczos kernel function.
 *
 * Computes the Lanczos windowed sinc value for a given distance `x`
 * and window size `a`. For Lanczos-3, `a = 3`.
 *
 * @param x - Distance from the center sample.
 * @param a - Window radius (3 for Lanczos-3).
 * @returns   The kernel weight.
 * @internal
 */
function lanczos(x: number, a: number = 3): number {
  if (x === 0) return 1;
  if (Math.abs(x) >= a) return 0;
  const pix = Math.PI * x;
  return (Math.sin(pix) / pix) * (Math.sin(pix / a) / (pix / a));
}

/**
 * Lanczos-3 resampling.
 *
 * Uses a 6-tap (a=3) windowed sinc filter in both dimensions for
 * high-quality downscaling. This is the best quality option but
 * also the slowest.
 *
 * @internal
 */
function resampleLanczos(
  src: RawImageData,
  dstWidth: number,
  dstHeight: number,
): RawImageData {
  const channels = src.channels;
  const a = 3; // Lanczos-3 window radius
  const dst = new Uint8Array(dstWidth * dstHeight * channels);

  const xRatio = src.width / dstWidth;
  const yRatio = src.height / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    // Map output pixel center to source coordinates
    const srcYf = (y + 0.5) * yRatio - 0.5;

    for (let x = 0; x < dstWidth; x++) {
      const srcXf = (x + 0.5) * xRatio - 0.5;

      const dstIdx = (y * dstWidth + x) * channels;

      // Accumulate weighted values for each channel
      const sum = new Float64Array(channels);
      let weightSum = 0;

      // Sample the neighborhood: floor(srcY) - a + 1 .. floor(srcY) + a
      const yStart = Math.floor(srcYf) - a + 1;
      const yEnd = Math.floor(srcYf) + a;
      const xStart = Math.floor(srcXf) - a + 1;
      const xEnd = Math.floor(srcXf) + a;

      for (let sy = yStart; sy <= yEnd; sy++) {
        const wy = lanczos(srcYf - sy, a);
        if (wy === 0) continue;

        // Clamp source Y to image bounds
        const clampedY = Math.max(0, Math.min(src.height - 1, sy));

        for (let sx = xStart; sx <= xEnd; sx++) {
          const wx = lanczos(srcXf - sx, a);
          if (wx === 0) continue;

          const w = wx * wy;

          // Clamp source X to image bounds
          const clampedX = Math.max(0, Math.min(src.width - 1, sx));

          const srcIdx = (clampedY * src.width + clampedX) * channels;

          for (let c = 0; c < channels; c++) {
            sum[c] = (sum[c] ?? 0) + src.pixels[srcIdx + c]! * w;
          }
          weightSum += w;
        }
      }

      // Normalize by total weight and clamp to [0, 255]
      if (weightSum > 0) {
        for (let c = 0; c < channels; c++) {
          dst[dstIdx + c] = Math.round(Math.max(0, Math.min(255, sum[c]! / weightSum)));
        }
      }
    }
  }

  return {
    pixels: dst,
    width: dstWidth,
    height: dstHeight,
    channels,
    bitsPerChannel: src.bitsPerChannel,
  };
}

// ---------------------------------------------------------------------------
// Internal: recompression implementations
// ---------------------------------------------------------------------------

/**
 * Recompress image data using deflate (for PDF FlateDecode).
 * @internal
 */
async function recompressDeflate(
  image: RawImageData,
  level: number,
): Promise<OptimizeResult> {
  // Try CompressionStream API
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    const chunks: Uint8Array[] = [];

    writer.write(new Uint8Array(image.pixels) as Uint8Array<ArrayBuffer>).catch(() => {});
    writer.close().catch(() => {});

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return {
      data: result,
      width: image.width,
      height: image.height,
      channels: image.channels,
      format: 'deflate',
      wasOptimized: true,
    };
  }

  // Fallback: try fflate
  try {
    const { deflateSync } = await import('fflate');
    const compressed = deflateSync(image.pixels, {
      level: level as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
    });

    return {
      data: compressed,
      width: image.width,
      height: image.height,
      channels: image.channels,
      format: 'deflate',
      wasOptimized: true,
    };
  } catch {
    // Return uncompressed
    return {
      data: image.pixels,
      width: image.width,
      height: image.height,
      channels: image.channels,
      format: 'raw',
      wasOptimized: false,
    };
  }
}

/**
 * Recompress image data as JPEG.
 * @internal
 */
/**
 * Recompress image data as JPEG.
 *
 * JPEG encoding in pure JS is complex (DCT, Huffman coding, quantization).
 * A full implementation requires either:
 *
 * 1. **WASM-based encoder** (preferred) -- compile libjpeg-turbo or mozjpeg
 *    to WASM, feed raw pixels, get JPEG bytes back.
 * 2. **Canvas API** (browser-only fallback) -- use `OffscreenCanvas` with
 *    `convertToBlob({ type: 'image/jpeg', quality })`.
 * 3. **Pure JS encoder** (last resort) -- very slow but works everywhere.
 *
 * Until a WASM encoder module is bundled, this function returns the input
 * data unchanged. The caller receives `format: 'raw'` and
 * `wasOptimized: false` to indicate that JPEG encoding was not applied.
 *
 * @param image   - The raw image pixel data.
 * @param quality - JPEG quality 1-100 (reserved for future use).
 * @returns         The input data as-is, marked as un-optimized.
 * @internal
 */
async function recompressJpeg(
  image: RawImageData,
  quality: number,
): Promise<OptimizeResult> {
  // Clamp quality to valid range for future use
  const _clampedQuality = Math.max(1, Math.min(100, Math.round(quality)));

  // JPEG encoding requires a WASM module (libjpeg-turbo / mozjpeg)
  // or browser Canvas API. Return input data unchanged until an
  // encoder is available.
  return {
    data: image.pixels,
    width: image.width,
    height: image.height,
    channels: image.channels,
    format: 'raw',
    wasOptimized: false,
  };
}
