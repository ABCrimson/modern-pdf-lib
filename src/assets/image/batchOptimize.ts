/**
 * @module assets/image/batchOptimize
 *
 * Batch image optimization for PDF documents.
 *
 * Provides `optimizeAllImages()` which walks all image XObjects in a
 * parsed PDF, recompresses them as JPEG (when beneficial), and replaces
 * the stream data in-place.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

import type { PdfDocument } from '../../core/pdfDocument.js';
import { PdfArray, PdfName } from '../../core/pdfObjects.js';
import { extractImages, decodeImageStream } from './imageExtract.js';
import type { ChromaSubsampling } from '../../wasm/jpeg/bridge.js';
import { isGrayscaleImage, convertToGrayscale } from './grayscaleDetect.js';
import { extractIccProfile, embedIccProfile } from './iccProfile.js';
import type { IccProfile } from './iccProfile.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Progress information passed to the `onProgress` callback.
 */
export interface ProgressInfo {
  /** 1-based index of the current image being processed. */
  readonly current: number;
  /** Total number of images to process. */
  readonly total: number;
  /** Resource name of the current image (e.g., '/Im1'). */
  readonly imageName: string;
  /** Page index (0-based) where the image appears. */
  readonly pageIndex: number;
  /** Bytes saved for this image (negative if image grew). */
  readonly savedBytes: number;
  /** Cumulative bytes saved so far. */
  readonly totalSavedBytes: number;
  /** Whether this image was skipped (by filter or incompatibility). */
  readonly skipped: boolean;
}

/**
 * Options for batch image optimization.
 */
export interface BatchOptimizeOptions {
  /**
   * JPEG quality (1–100) for recompressed images.
   *
   * Default: `80`.
   */
  readonly quality?: number;
  /**
   * Maximum DPI for images.  Images exceeding this DPI at their
   * display size will be downscaled before recompression.
   *
   * Default: `150`.
   */
  readonly maxDpi?: number;
  /**
   * Encode as progressive JPEG.
   *
   * Default: `false`.
   */
  readonly progressive?: boolean;
  /**
   * Chroma subsampling mode for JPEG encoding.
   *
   * Default: `'4:2:0'`.
   */
  readonly chromaSubsampling?: ChromaSubsampling;
  /**
   * Skip images smaller than this threshold (in bytes).
   *
   * Default: `false` (process all images).
   */
  readonly skipSmallImages?: boolean;
  /**
   * Minimum savings percentage required to replace an image.
   * If the recompressed image is not at least this much smaller,
   * the original is kept.
   *
   * Default: `10`.
   */
  readonly minSavingsPercent?: number;
  /**
   * Auto-detect and convert pseudo-grayscale RGB images to true
   * grayscale before encoding.
   *
   * Default: `false`.
   */
  readonly autoGrayscale?: boolean;

  // --- Selective filters ---

  /**
   * Only optimize images on pages within this range (0-indexed, inclusive).
   *
   * Images on pages outside this range are skipped and counted as
   * `skippedByFilter` in the report.
   */
  readonly pageRange?: { readonly start: number; readonly end: number };

  /**
   * Skip images with compressed size below this threshold in bytes.
   *
   * Default: `0` (no minimum).
   */
  readonly minImageSize?: number;

  /**
   * Only optimize images in these color spaces
   * (e.g. `'DeviceRGB'`, `'DeviceCMYK'`, `'ICCBased'`).
   *
   * Images in other color spaces are skipped.
   */
  readonly colorSpaces?: readonly string[];

  /**
   * Only optimize images whose resource name matches this pattern.
   *
   * For example, `/Im[0-3]/` would only optimize images named
   * `/Im0` through `/Im3`.
   */
  readonly namePattern?: RegExp;

  /**
   * Maximum number of images to process concurrently.
   *
   * Default: `1` (sequential).  Values less than 1 are treated as 1.
   */
  readonly concurrency?: number;

  /**
   * Progress callback invoked after each image is processed.
   */
  readonly onProgress?: (info: ProgressInfo) => void;
}

/**
 * Per-image optimization report entry.
 */
export interface ImageOptimizeEntry {
  /** Resource name (e.g. '/Im1'). */
  readonly name: string;
  /** Page index where this image appears. */
  readonly pageIndex: number;
  /** Original compressed size in bytes. */
  readonly originalSize: number;
  /** New compressed size in bytes (same as original if skipped). */
  readonly newSize: number;
  /** Whether this image was skipped. */
  readonly skipped: boolean;
  /** Whether this image was skipped due to a selective filter. */
  readonly skippedByFilter: boolean;
  /** Reason for skipping, if applicable. */
  readonly reason?: string;
}

/**
 * Summary report from batch image optimization.
 */
export interface OptimizationReport {
  /** Total number of image XObjects found. */
  readonly totalImages: number;
  /** Number of images that were recompressed. */
  readonly optimizedImages: number;
  /** Number of images skipped due to selective filters. */
  readonly skippedByFilter: number;
  /** Total original compressed size (all images). */
  readonly originalTotalBytes: number;
  /** Total new compressed size (all images). */
  readonly optimizedTotalBytes: number;
  /** Overall savings percentage. */
  readonly savings: number;
  /** Per-image details. */
  readonly perImage: readonly ImageOptimizeEntry[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum image size to bother optimizing (10 KB). */
const SMALL_IMAGE_THRESHOLD = 10_240;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Process items concurrently with a maximum parallelism limit.
 * Workers pull from a shared index — no item is processed twice.
 */
async function processWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        await processor(items[index]!, index);
      }
    },
  );
  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Optimize all images in a PDF document by recompressing them as JPEG.
 *
 * Walks every image XObject in the document, decodes its pixel data,
 * recompresses it as JPEG using the WASM encoder (if available), and
 * replaces the stream data in-place when the result is smaller.
 *
 * **Requires the JPEG WASM module to be initialized** via
 * `initJpegWasm()` or `initWasm({ jpeg: true })`.  Without it,
 * no images will be optimized (all will be skipped).
 *
 * @param doc     - A parsed `PdfDocument` (from `loadPdf()`).
 * @param options - Optimization settings.
 * @returns A report summarizing the optimization results.
 *
 * @example
 * ```ts
 * import { loadPdf, initWasm, optimizeAllImages } from 'modern-pdf-lib';
 *
 * await initWasm({ jpeg: true });
 *
 * const doc = await loadPdf(pdfBytes);
 * const report = await optimizeAllImages(doc);
 *
 * console.log(`Optimized ${report.optimizedImages} of ${report.totalImages} images`);
 * console.log(`Savings: ${report.savings.toFixed(1)}%`);
 *
 * const optimizedBytes = await doc.save();
 * ```
 */
export async function optimizeAllImages(
  doc: PdfDocument,
  options: BatchOptimizeOptions = {},
): Promise<OptimizationReport> {
  const quality = options.quality ?? 80;
  const minSavingsPercent = options.minSavingsPercent ?? 10;
  const skipSmall = options.skipSmallImages ?? false;
  const progressive = options.progressive ?? false;
  const chromaSubsampling = options.chromaSubsampling ?? '4:2:0';
  const concurrency = Math.max(1, options.concurrency ?? 1);

  // Selective filter options
  const { pageRange, minImageSize, colorSpaces, namePattern } = options;

  // Dynamically import JPEG bridge to avoid circular deps
  const { encodeJpegWasm, isJpegWasmReady } = await import(
    '../../wasm/jpeg/bridge.js'
  );
  const { decodeJpegWasm } = await import('../../wasm/jpeg/bridge.js');

  const images = extractImages(doc);
  const registry = doc.getRegistry();

  // Pre-allocate results array — one slot per image, filled by index
  // to guarantee correct ordering regardless of processing order.
  const results = new Array<ImageOptimizeEntry>(images.length);

  /** Process a single image and write the result into `results[index]`. */
  const processImage = async (img: (typeof images)[number], index: number): Promise<void> => {
    // Helper to record a skipped entry
    const skip = (
      skippedByFilter: boolean,
      reason: string,
    ): void => {
      results[index] = {
        name: img.name,
        pageIndex: img.pageIndex,
        originalSize: img.compressedSize,
        newSize: img.compressedSize,
        skipped: true,
        skippedByFilter,
        reason,
      };
    };

    // Apply selective filters
    if (pageRange && (img.pageIndex < pageRange.start || img.pageIndex > pageRange.end)) {
      return skip(true, `Page ${img.pageIndex} outside range [${pageRange.start}, ${pageRange.end}]`);
    }
    if (minImageSize && img.compressedSize < minImageSize) {
      return skip(true, `Compressed size ${img.compressedSize} below minimum ${minImageSize} bytes`);
    }
    if (colorSpaces && !colorSpaces.includes(img.colorSpace)) {
      return skip(true, `Color space '${img.colorSpace}' not in allowed list`);
    }
    if (namePattern && !namePattern.test(img.name)) {
      return skip(true, `Name '${img.name}' does not match pattern ${namePattern}`);
    }

    // Skip if WASM encoder not available
    if (!isJpegWasmReady()) {
      return skip(false, 'JPEG WASM encoder not initialized');
    }

    // Skip small images
    if (skipSmall && img.compressedSize < SMALL_IMAGE_THRESHOLD) {
      return skip(false, `Below size threshold (${SMALL_IMAGE_THRESHOLD} bytes)`);
    }

    // Skip non-8-bit images
    if (img.bitsPerComponent !== 8) {
      return skip(false, `Unsupported bits per component: ${img.bitsPerComponent}`);
    }

    // Skip indexed color space (palette images)
    if (img.colorSpace === 'Indexed') {
      return skip(false, 'Indexed color space not suitable for JPEG');
    }

    // Extract ICC profile before any conversion (may be reattached later)
    let iccProfile: IccProfile | undefined;
    try {
      iccProfile = extractIccProfile(img.stream, registry);
    } catch {
      // Non-fatal: if ICC extraction fails, proceed without it
      iccProfile = undefined;
    }

    // Decode the stream to get raw pixels
    let pixels: Uint8Array;
    let channels = img.channels as 1 | 3 | 4;

    try {
      if (img.filters[0] === 'DCTDecode') {
        // Already JPEG — decode to pixels first using WASM decoder
        const decoded = decodeJpegWasm(img.stream.data);
        if (!decoded) {
          return skip(false, 'Failed to decode existing JPEG');
        }
        pixels = decoded.pixels;
        channels = decoded.channels as 1 | 3 | 4;
      } else {
        // FlateDecode or other — decode to raw pixels
        pixels = decodeImageStream(img);
      }
    } catch {
      return skip(false, 'Failed to decode image stream');
    }

    // Validate pixel data length
    const expectedLen = img.width * img.height * channels;
    if (pixels.length !== expectedLen) {
      return skip(false, `Pixel data length mismatch: got ${pixels.length}, expected ${expectedLen}`);
    }

    // Handle CMYK conversion
    if (channels === 4 && img.colorSpace === 'DeviceCMYK') {
      const rgb = new Uint8Array(img.width * img.height * 3);
      for (let i = 0; i < img.width * img.height; i++) {
        const c = pixels[i * 4]! / 255;
        const m = pixels[i * 4 + 1]! / 255;
        const y = pixels[i * 4 + 2]! / 255;
        const k = pixels[i * 4 + 3]! / 255;
        rgb[i * 3] = Math.round(255 * (1 - c) * (1 - k));
        rgb[i * 3 + 1] = Math.round(255 * (1 - m) * (1 - k));
        rgb[i * 3 + 2] = Math.round(255 * (1 - y) * (1 - k));
      }
      pixels = rgb;
      channels = 3;
    }

    // Auto-detect and convert grayscale
    let convertedToGrayscale = false;
    if (options.autoGrayscale && (channels === 3 || channels === 4)) {
      if (isGrayscaleImage(pixels, img.width, img.height, channels as 3 | 4)) {
        pixels = convertToGrayscale(pixels, img.width, img.height, channels as 3 | 4);
        channels = 1;
        convertedToGrayscale = true;
      }
    }

    // Encode to JPEG
    const jpegBytes = encodeJpegWasm(
      pixels,
      img.width,
      img.height,
      channels,
      quality,
      progressive,
      chromaSubsampling,
    );

    if (!jpegBytes) {
      return skip(false, 'JPEG encoding failed');
    }

    // Check if savings meet threshold
    const savingsPercent =
      ((img.compressedSize - jpegBytes.length) / img.compressedSize) * 100;

    if (savingsPercent < minSavingsPercent) {
      return skip(false, `Savings ${savingsPercent.toFixed(1)}% below threshold ${minSavingsPercent}%`);
    }

    // Replace stream data in-place
    img.stream.data = jpegBytes;
    img.stream.syncLength();

    // Update stream dictionary
    const dict = img.stream.dict;

    // Set filter to DCTDecode
    dict.set('/Filter', PdfName.of('/DCTDecode'));

    // Determine output color space — preserve ICC profile when possible
    if (channels === 1) {
      // Grayscale output: don't reattach an RGB/CMYK ICC profile
      dict.set('/ColorSpace', PdfName.of('/DeviceGray'));
    } else if (
      iccProfile &&
      !convertedToGrayscale &&
      iccProfile.components === channels
    ) {
      // Preserve the ICC profile: create a new stream and set
      // /ColorSpace to [/ICCBased <profile ref>]
      const profileRef = embedIccProfile(iccProfile, registry);
      dict.set(
        '/ColorSpace',
        PdfArray.of([PdfName.of('/ICCBased'), profileRef]),
      );
    } else if (img.colorSpace === 'DeviceCMYK' && channels === 3) {
      dict.set('/ColorSpace', PdfName.of('/DeviceRGB'));
    } else if (channels === 3) {
      dict.set('/ColorSpace', PdfName.of('/DeviceRGB'));
    }

    // Remove DecodeParms (JPEG doesn't use PDF-level predictors)
    dict.delete('/DecodeParms');

    // Remove CMYK-specific Decode array if present
    if (img.colorSpace === 'DeviceCMYK') {
      dict.delete('/Decode');
    }

    results[index] = {
      name: img.name,
      pageIndex: img.pageIndex,
      originalSize: img.compressedSize,
      newSize: jpegBytes.length,
      skipped: false,
      skippedByFilter: false,
    };
  };

  // Process all images with the configured concurrency level
  await processWithConcurrency(images, concurrency, processImage);

  // Compute aggregates from the ordered results array
  let totalOriginal = 0;
  let totalNew = 0;
  let optimizedCount = 0;
  let skippedByFilterCount = 0;
  let cumulativeSavedBytes = 0;

  const { onProgress } = options;

  for (let i = 0; i < results.length; i++) {
    const entry = results[i]!;
    totalOriginal += entry.originalSize;
    totalNew += entry.newSize;
    if (!entry.skipped) optimizedCount++;
    if (entry.skippedByFilter) skippedByFilterCount++;

    // Fire progress callback in input order after all processing is done
    if (onProgress) {
      const saved = entry.originalSize - entry.newSize;
      cumulativeSavedBytes += saved;
      onProgress({
        current: i + 1,
        total: images.length,
        imageName: entry.name,
        pageIndex: entry.pageIndex,
        savedBytes: saved,
        totalSavedBytes: cumulativeSavedBytes,
        skipped: entry.skipped,
      });
    }
  }

  const overallSavings =
    totalOriginal > 0
      ? ((totalOriginal - totalNew) / totalOriginal) * 100
      : 0;

  return {
    totalImages: images.length,
    optimizedImages: optimizedCount,
    skippedByFilter: skippedByFilterCount,
    originalTotalBytes: totalOriginal,
    optimizedTotalBytes: totalNew,
    savings: overallSavings,
    perImage: results,
  };
}
