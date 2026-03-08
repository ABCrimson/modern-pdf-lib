/**
 * @module assets/image/compressionAnalysis
 *
 * Pre-optimization compression ratio analysis for PDF images.
 *
 * Provides `analyzeImages()` which inspects all image XObjects in a
 * parsed PDF document and reports current vs. optimal encoding per image
 * **without modifying the document**.
 *
 * No Buffer — uses Uint8Array exclusively.
 */

import type { PdfDocument } from '../../core/pdfDocument.js';
import { extractImages, decodeImageStream } from './imageExtract.js';
import { isJpegWasmReady, encodeJpegWasm } from '../../wasm/jpeg/bridge.js';
import { isGrayscaleImage } from './grayscaleDetect.js';
import { computeImageDpi } from './dpiAnalyze.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Per-image analysis result.
 */
export interface ImageAnalysis {
  /** Resource name on the page (e.g. '/Im1'). */
  readonly name: string;
  /** Zero-based page index where this image appears. */
  readonly pageIndex: number;
  /** Image width in pixels. */
  readonly width: number;
  /** Image height in pixels. */
  readonly height: number;
  /** Size of the current (compressed) stream data in bytes. */
  readonly currentSize: number;
  /** Description of the current encoding (e.g. 'FlateDecode', 'DCTDecode'). */
  readonly currentFormat: string;
  /** PDF color space name (e.g. 'DeviceRGB', 'DeviceGray'). */
  readonly colorSpace: string;
  /** Estimated JPEG-encoded size in bytes. */
  readonly estimatedJpegSize: number;
  /** Estimated savings in bytes (`currentSize - estimatedJpegSize`). */
  readonly estimatedSavings: number;
  /** Savings as a percentage of the current size. */
  readonly savingsPercent: number;
  /** Whether the image is effectively grayscale (even if stored as RGB). */
  readonly isGrayscale: boolean;
  /** Effective DPI of the image at its display size, or `undefined` if unknown. */
  readonly effectiveDpi: number | undefined;
  /** Recommended action for this image. */
  readonly recommendation: 'recompress' | 'keep' | 'downscale' | 'grayscale';
}

/**
 * Full document analysis report.
 */
export interface AnalysisReport {
  /** Per-image analysis results. */
  readonly images: readonly ImageAnalysis[];
  /** Total size of all image streams in bytes. */
  readonly totalCurrentSize: number;
  /** Total estimated size after optimization. */
  readonly totalEstimatedSize: number;
  /** Total estimated savings in bytes. */
  readonly totalSavings: number;
  /** Total savings as a percentage of total current size. */
  readonly totalSavingsPercent: number;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for `analyzeImages()`.
 */
export interface AnalyzeImagesOptions {
  /**
   * JPEG quality used for size estimation (1–100).
   *
   * Default: `80`.
   */
  readonly quality?: number;
  /**
   * Maximum allowed DPI.  Images exceeding this at their display size
   * receive a `'downscale'` recommendation.
   *
   * Default: `150`.
   */
  readonly maxDpi?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Determine the human-readable format name from filter names.
 * @internal
 */
function formatFromFilters(filters: readonly string[]): string {
  if (filters.length === 0) return 'Raw';
  // Use the first meaningful filter
  for (const f of filters) {
    if (f === 'DCTDecode') return 'JPEG';
    if (f === 'JPXDecode') return 'JPEG2000';
    if (f === 'CCITTFaxDecode') return 'CCITT';
    if (f === 'JBIG2Decode') return 'JBIG2';
    if (f === 'FlateDecode') return 'FlateDecode';
    if (f === 'LZWDecode') return 'LZW';
    if (f === 'RunLengthDecode') return 'RunLength';
    if (f === 'ASCIIHexDecode') return 'ASCIIHex';
    if (f === 'ASCII85Decode') return 'ASCII85';
  }
  return filters[0] ?? 'Unknown';
}

/**
 * Estimate JPEG size using a heuristic when WASM is not available.
 *
 * At quality 80, JPEG is typically 10–15% of raw pixel data size for
 * photographic content.  We use 12.5% as a reasonable middle estimate
 * and scale linearly with quality.
 *
 * @internal
 */
function estimateJpegSizeHeuristic(
  width: number,
  height: number,
  channels: number,
  quality: number,
): number {
  const rawSize = width * height * channels;
  // Base ratio at quality 80 ≈ 12.5%
  const baseRatio = 0.125;
  // Scale linearly: lower quality → smaller, higher quality → larger
  const qualityFactor = quality / 80;
  const estimated = Math.round(rawSize * baseRatio * qualityFactor);
  // JPEG has overhead — minimum ~200 bytes for headers
  return Math.max(200, estimated);
}

/**
 * Determine the recommendation for an image.
 * @internal
 */
function determineRecommendation(
  savingsPercent: number,
  isGrayscale: boolean,
  colorSpace: string,
  effectiveDpi: number | undefined,
  maxDpi: number,
): 'recompress' | 'keep' | 'downscale' | 'grayscale' {
  // If the image is RGB but effectively grayscale, recommend grayscale conversion
  if (isGrayscale && colorSpace !== 'DeviceGray' && colorSpace !== 'CalGray') {
    return 'grayscale';
  }
  // If DPI exceeds the max, recommend downscaling
  if (effectiveDpi !== undefined && Number.isFinite(effectiveDpi) && effectiveDpi > maxDpi) {
    return 'downscale';
  }
  // If savings exceed 10%, recommend recompression
  if (savingsPercent > 10) {
    return 'recompress';
  }
  return 'keep';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze all images in a PDF and report potential savings without
 * modifying the document.
 *
 * For each image XObject with `bitsPerComponent === 8` and 1–4 channels,
 * the function estimates the JPEG-encoded size — using the WASM encoder
 * when available, or a heuristic fallback otherwise.
 *
 * @param doc     - A parsed `PdfDocument`.
 * @param options - Optional quality and maxDpi settings.
 * @returns An `AnalysisReport` with per-image and aggregate statistics.
 *
 * @example
 * ```ts
 * import { loadPdf, analyzeImages } from 'modern-pdf-lib';
 *
 * const doc = await loadPdf(pdfBytes);
 * const report = analyzeImages(doc, { quality: 75, maxDpi: 150 });
 *
 * console.log(`Total savings: ${report.totalSavingsPercent.toFixed(1)}%`);
 * for (const img of report.images) {
 *   console.log(`  ${img.name}: ${img.recommendation} (${img.savingsPercent.toFixed(1)}%)`);
 * }
 * ```
 */
export function analyzeImages(
  doc: PdfDocument,
  options?: AnalyzeImagesOptions,
): AnalysisReport {
  const quality = options?.quality ?? 80;
  const maxDpi = options?.maxDpi ?? 150;

  const allImages = extractImages(doc);
  const analyses: ImageAnalysis[] = [];

  const wasmReady = isJpegWasmReady();

  for (const info of allImages) {
    const currentSize = info.compressedSize;
    const currentFormat = formatFromFilters(info.filters);

    // Only analyze 8-bit images with 1–4 channels
    if (info.bitsPerComponent !== 8 || info.channels < 1 || info.channels > 4) {
      // Cannot analyze — keep as-is
      analyses.push({
        name: info.name,
        pageIndex: info.pageIndex,
        width: info.width,
        height: info.height,
        currentSize,
        currentFormat,
        colorSpace: info.colorSpace,
        estimatedJpegSize: currentSize,
        estimatedSavings: 0,
        savingsPercent: 0,
        isGrayscale: false,
        effectiveDpi: undefined,
        recommendation: 'keep',
      });
      continue;
    }

    // Decode the image stream to raw pixels
    let pixels: Uint8Array | undefined;
    try {
      pixels = decodeImageStream(info);
    } catch {
      // Decoding failed — can't analyze
      analyses.push({
        name: info.name,
        pageIndex: info.pageIndex,
        width: info.width,
        height: info.height,
        currentSize,
        currentFormat,
        colorSpace: info.colorSpace,
        estimatedJpegSize: currentSize,
        estimatedSavings: 0,
        savingsPercent: 0,
        isGrayscale: false,
        effectiveDpi: undefined,
        recommendation: 'keep',
      });
      continue;
    }

    // Check if the image is effectively grayscale
    let grayscale = false;
    if (
      (info.channels === 3 || info.channels === 4) &&
      pixels.length >= info.width * info.height * info.channels
    ) {
      grayscale = isGrayscaleImage(
        pixels,
        info.width,
        info.height,
        info.channels as 3 | 4,
      );
    } else if (info.channels === 1) {
      grayscale = true;
    }

    // Estimate JPEG size
    let estimatedJpegSize: number;

    if (wasmReady && pixels.length >= info.width * info.height * info.channels) {
      // Use WASM encoder for an accurate estimate
      const channels = info.channels <= 4 ? (info.channels as 1 | 3 | 4) : 3;
      const encoded = encodeJpegWasm(pixels, info.width, info.height, channels, quality);
      if (encoded) {
        estimatedJpegSize = encoded.length;
      } else {
        // WASM encode failed — fall back to heuristic
        estimatedJpegSize = estimateJpegSizeHeuristic(info.width, info.height, info.channels, quality);
      }
    } else {
      // No WASM — use heuristic estimate
      estimatedJpegSize = estimateJpegSizeHeuristic(info.width, info.height, info.channels, quality);
    }

    // Compute savings (never report negative savings)
    const estimatedSavings = Math.max(0, currentSize - estimatedJpegSize);
    const savingsPercent = currentSize > 0
      ? (estimatedSavings / currentSize) * 100
      : 0;

    // Compute effective DPI (undefined if we can't determine display size)
    // We don't have display dimensions from ImageInfo alone, so DPI is
    // estimated assuming the image is displayed at its native pixel size
    // (1 pixel = 1 point), which is the worst case.  Real display size
    // would require parsing the content stream CTM.
    const effectiveDpi = computeImageDpi(
      info.width,
      info.height,
      info.width,
      info.height,
    ).effectiveDpi;

    // Determine recommendation
    const recommendation = determineRecommendation(
      savingsPercent,
      grayscale,
      info.colorSpace,
      effectiveDpi,
      maxDpi,
    );

    analyses.push({
      name: info.name,
      pageIndex: info.pageIndex,
      width: info.width,
      height: info.height,
      currentSize,
      currentFormat,
      colorSpace: info.colorSpace,
      estimatedJpegSize,
      estimatedSavings,
      savingsPercent,
      isGrayscale: grayscale,
      effectiveDpi,
      recommendation,
    });
  }

  // Compute totals
  const totalCurrentSize = analyses.reduce((sum, a) => sum + a.currentSize, 0);
  const totalEstimatedSize = analyses.reduce((sum, a) => sum + a.estimatedJpegSize, 0);
  const totalSavings = Math.max(0, totalCurrentSize - totalEstimatedSize);
  const totalSavingsPercent = totalCurrentSize > 0
    ? (totalSavings / totalCurrentSize) * 100
    : 0;

  return {
    images: analyses,
    totalCurrentSize,
    totalEstimatedSize,
    totalSavings,
    totalSavingsPercent,
  };
}
