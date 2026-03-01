# Image Optimization

Reduce PDF file sizes by recompressing, deduplicating, and downscaling images — the single largest contributor to bloated PDFs.

## Prerequisites

Image optimization requires the JPEG WASM module:

```ts
import { initWasm } from 'modern-pdf-lib';

await initWasm({ jpeg: true });
```

Without it, images are skipped (no errors, no changes).

## Batch Optimize All Images

The simplest path: load a PDF, optimize everything, save.

```ts
import { loadPdf, initWasm, optimizeAllImages } from 'modern-pdf-lib';

await initWasm({ jpeg: true });

const doc = await loadPdf(pdfBytes);
const report = await optimizeAllImages(doc, {
  quality: 75,
  progressive: true,
});

console.log(`${report.optimizedImages}/${report.totalImages} images optimized`);
console.log(`Savings: ${report.savings.toFixed(1)}%`);

const optimizedBytes = await doc.save();
```

### Options

| Option | Type | Default | Description |
|:---|:---|:---|:---|
| `quality` | `number` | `80` | JPEG quality (1–100) |
| `maxDpi` | `number` | `150` | Maximum DPI — images exceeding this are downscaled |
| `progressive` | `boolean` | `false` | Encode as progressive JPEG |
| `chromaSubsampling` | `string` | `'4:2:0'` | Chroma subsampling: `'4:4:4'`, `'4:2:2'`, or `'4:2:0'` |
| `skipSmallImages` | `boolean` | `false` | Skip images smaller than 10 KB |
| `minSavingsPercent` | `number` | `10` | Only replace if savings exceed this percentage |
| `autoGrayscale` | `boolean` | `false` | Auto-detect and convert pseudo-grayscale RGB images |

### Report Structure

```ts
interface OptimizationReport {
  totalImages: number;
  optimizedImages: number;
  originalTotalBytes: number;
  optimizedTotalBytes: number;
  savings: number;               // percentage
  perImage: ImageOptimizeEntry[];
}
```

Each `perImage` entry includes `name`, `pageIndex`, `originalSize`, `newSize`, `skipped`, and optional `reason`.

## Image Deduplication

Remove duplicate images that appear multiple times in a document:

```ts
import { loadPdf, deduplicateImages } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const report = deduplicateImages(doc);

console.log(`Removed ${report.duplicatesRemoved} duplicates`);
console.log(`Saved ~${(report.bytesSaved / 1024).toFixed(0)} KB`);

const bytes = await doc.save();
```

Deduplication uses FNV-1a hashing on stream data, dimensions, and filter — fast and synchronous.

::: tip
Run deduplication **before** `optimizeAllImages()` for the best results. Dedup reduces the number of images that need to be recompressed.
:::

## Grayscale Detection

Detect and convert RGB images that are visually grayscale — saves ~66% per image:

```ts
import { isGrayscaleImage, convertToGrayscale } from 'modern-pdf-lib';

if (isGrayscaleImage(pixels, width, height, 3)) {
  const grayPixels = convertToGrayscale(pixels, width, height, 3);
  // grayPixels: 1 byte per pixel instead of 3
}
```

Set `autoGrayscale: true` in `optimizeAllImages()` to enable this automatically.

## Quality Estimation

Estimate the quality of an existing JPEG:

```ts
import { estimateJpegQuality } from 'modern-pdf-lib';

const quality = estimateJpegQuality(jpegBytes);
console.log(`Estimated quality: ${quality}`); // 1–100
```

This analyzes the quantization tables (DQT markers) in the JPEG header — no WASM needed.

## Image Extraction

Inspect all images in a PDF without modifying it:

```ts
import { loadPdf, extractImages, decodeImageStream } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const images = extractImages(doc);

for (const img of images) {
  console.log(`${img.name}: ${img.width}x${img.height} ${img.colorSpace}`);
  console.log(`  Page ${img.pageIndex}, ${img.compressedSize} bytes, filter: ${img.filters.join(',')}`);

  // Decode to raw bytes if needed
  const raw = decodeImageStream(img);
}
```

## DPI Analysis

Compute the effective DPI of an image at a given display size:

```ts
import { computeImageDpi, computeTargetDimensions } from 'modern-pdf-lib';

// 3000x2000 image displayed at 300x200 points (4.17"x2.78")
const dpi = computeImageDpi(3000, 2000, 300, 200);
console.log(`Effective DPI: ${dpi.effectiveDpi}`); // 720

// Compute downscale target for 150 max DPI
const target = computeTargetDimensions(3000, 2000, 300, 200, 150);
if (target.downscaled) {
  console.log(`Downscale to: ${target.width}x${target.height}`);
}
```

## CLI

Optimize images from the command line:

```sh
npx modern-pdf optimize input.pdf output.pdf [options]
```

### Options

```
--quality <n>, -q <n>   JPEG quality 1-100 (default: 80)
--progressive           Use progressive JPEG encoding
--grayscale             Auto-detect and convert grayscale images
--dedup                 Deduplicate identical images
--chroma <mode>         Chroma subsampling: 4:4:4, 4:2:2, 4:2:0 (default: 4:2:0)
--verbose, -v           Print per-image optimization details
--help, -h              Show help
```

### Examples

```sh
# Basic optimization
npx modern-pdf optimize report.pdf report-opt.pdf

# Aggressive optimization with verbose output
npx modern-pdf optimize scan.pdf scan-opt.pdf --quality 60 --grayscale --dedup -v

# High-quality progressive JPEG
npx modern-pdf optimize photo-book.pdf out.pdf --quality 90 --progressive --chroma 4:4:4
```

## Architecture

The image optimization stack:

```
optimizeAllImages()
  ├── extractImages()           Walk pages → collect image XObjects
  ├── decodeImageStream()       Decode FlateDecode / DCTDecode streams
  ├── isGrayscaleImage()        Optional auto-detection
  ├── convertToGrayscale()      Optional RGB → grayscale
  ├── convertCmykToRgb()        CMYK → RGB conversion
  ├── encodeJpegWasm()          JPEG encoding via WASM
  └── stream.data = jpegBytes   In-place stream replacement
```

All WASM functions have JS fallbacks. Without the JPEG WASM module, images are simply skipped (not an error).
