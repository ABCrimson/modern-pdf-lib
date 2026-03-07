/**
 * Image optimization benchmark suite.
 *
 * Measures the performance of downscaleImage() across different algorithms,
 * image sizes, and channel counts.
 *
 * Run: npx vitest bench tests/image/optimization.bench.ts
 */

import { bench, describe } from 'vitest';
import {
  downscaleImage,
  recompressImage,
  optimizeImage,
} from '../../src/assets/image/imageOptimize.js';
import type { RawImageData } from '../../src/assets/image/imageOptimize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a synthetic test image with a deterministic gradient pattern.
 * The pattern produces realistic pixel variation (not all zeros) so that
 * resampling kernels do meaningful work.
 */
function generateTestImage(
  w: number,
  h: number,
  channels: 1 | 2 | 3 | 4,
): RawImageData {
  const pixels = new Uint8Array(w * h * channels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      for (let c = 0; c < channels; c++) {
        pixels[i + c] = ((x + y * 3 + c * 50) * 7) & 0xff;
      }
    }
  }
  return { pixels, width: w, height: h, channels, bitsPerChannel: 8 };
}

// ---------------------------------------------------------------------------
// Pre-generate test images (outside bench calls to avoid allocation noise)
// ---------------------------------------------------------------------------

const large_rgb = generateTestImage(2000, 1500, 3);
const medium_rgb = generateTestImage(800, 600, 3);
const large_gray = generateTestImage(2000, 1500, 1);
const large_rgba = generateTestImage(2000, 1500, 4);
const small_rgb = generateTestImage(256, 256, 3);

// ═══════════════════════════════════════════════════════════════════════════
// 1. DOWNSCALE BENCHMARKS — Algorithm comparison
// ═══════════════════════════════════════════════════════════════════════════

describe('Downscale — Algorithm comparison (2000x1500 RGB -> 500x375)', () => {
  bench('Lanczos3', () => {
    downscaleImage(large_rgb, { maxWidth: 500, algorithm: 'lanczos' });
  });

  bench('Bilinear', () => {
    downscaleImage(large_rgb, { maxWidth: 500, algorithm: 'bilinear' });
  });

  bench('Nearest', () => {
    downscaleImage(large_rgb, { maxWidth: 500, algorithm: 'nearest' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. DOWNSCALE BENCHMARKS — Size comparison (Lanczos)
// ═══════════════════════════════════════════════════════════════════════════

describe('Downscale — Size comparison (Lanczos3)', () => {
  bench('2000x1500 -> 500x375', () => {
    downscaleImage(large_rgb, { maxWidth: 500, algorithm: 'lanczos' });
  });

  bench('800x600 -> 200x150', () => {
    downscaleImage(medium_rgb, { maxWidth: 200, algorithm: 'lanczos' });
  });

  bench('2000x1500 -> 1000x750 (2x)', () => {
    downscaleImage(large_rgb, { maxWidth: 1000, algorithm: 'lanczos' });
  });

  bench('256x256 -> 64x64', () => {
    downscaleImage(small_rgb, { maxWidth: 64, algorithm: 'lanczos' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. DOWNSCALE BENCHMARKS — Channel count comparison (Lanczos)
// ═══════════════════════════════════════════════════════════════════════════

describe('Downscale — Channel count (Lanczos3 2000x1500 -> 500)', () => {
  bench('Grayscale (1 channel)', () => {
    downscaleImage(large_gray, { maxWidth: 500, algorithm: 'lanczos' });
  });

  bench('RGB (3 channels)', () => {
    downscaleImage(large_rgb, { maxWidth: 500, algorithm: 'lanczos' });
  });

  bench('RGBA (4 channels)', () => {
    downscaleImage(large_rgba, { maxWidth: 500, algorithm: 'lanczos' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. DOWNSCALE BENCHMARKS — No-op (image already within bounds)
// ═══════════════════════════════════════════════════════════════════════════

describe('Downscale — No-op (already within bounds)', () => {
  bench('256x256 with maxWidth: 512 (no scaling needed)', () => {
    downscaleImage(small_rgb, { maxWidth: 512, algorithm: 'lanczos' });
  });

  bench('256x256 with maxHeight: 512 (no scaling needed)', () => {
    downscaleImage(small_rgb, { maxHeight: 512, algorithm: 'lanczos' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. RECOMPRESS BENCHMARKS — Deflate only (JPEG needs WASM)
// ═══════════════════════════════════════════════════════════════════════════

describe('Recompress — Deflate', () => {
  const small_for_compress = generateTestImage(128, 128, 3);

  bench('128x128 RGB deflate level 6', async () => {
    await recompressImage(small_for_compress, {
      format: 'deflate',
      compressionLevel: 6,
    });
  });

  bench('128x128 RGB deflate level 9', async () => {
    await recompressImage(small_for_compress, {
      format: 'deflate',
      compressionLevel: 9,
    });
  });

  bench('128x128 RGB deflate level 1', async () => {
    await recompressImage(small_for_compress, {
      format: 'deflate',
      compressionLevel: 1,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. OPTIMIZE PIPELINE — Downscale + recompress combined
// ═══════════════════════════════════════════════════════════════════════════

describe('Optimize pipeline — Downscale + deflate', () => {
  bench('800x600 -> 200x150 + deflate', async () => {
    await optimizeImage(medium_rgb, {
      maxWidth: 200,
      algorithm: 'lanczos',
      format: 'deflate',
      compressionLevel: 6,
    });
  });

  bench('256x256 -> 64x64 + deflate', async () => {
    await optimizeImage(small_rgb, {
      maxWidth: 64,
      algorithm: 'lanczos',
      format: 'deflate',
      compressionLevel: 6,
    });
  });

  bench('800x600 -> skip (below bytes threshold)', async () => {
    await optimizeImage(medium_rgb, {
      maxWidth: 200,
      skipBelowBytes: medium_rgb.pixels.length + 1,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. DOWNSCALE BENCHMARKS — DPI-based scaling
// ═══════════════════════════════════════════════════════════════════════════

describe('Downscale — DPI-based targeting', () => {
  bench('2000x1500 at 300dpi -> 150dpi (Lanczos3)', () => {
    // Assume image is displayed at 2000/300*72 x 1500/300*72 points
    const printWidth = (2000 / 300) * 72;
    const printHeight = (1500 / 300) * 72;
    downscaleImage(large_rgb, {
      targetDpi: 150,
      printWidth,
      printHeight,
      algorithm: 'lanczos',
    });
  });

  bench('800x600 at 200dpi -> 72dpi (Bilinear)', () => {
    const printWidth = (800 / 200) * 72;
    const printHeight = (600 / 200) * 72;
    downscaleImage(medium_rgb, {
      targetDpi: 72,
      printWidth,
      printHeight,
      algorithm: 'bilinear',
    });
  });
});
