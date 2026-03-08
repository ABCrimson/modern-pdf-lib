# Image Format Support

modern-pdf-lib supports embedding images in all major raster formats. Each format is handled optimally for PDF output -- direct passthrough where possible, lossless conversion where necessary.

## Overview

| Format | Extension | Compression | Transparency | Color Spaces | PDF Embedding |
|--------|-----------|-------------|--------------|--------------|---------------|
| **PNG** | `.png` | Lossless (Deflate) | Yes (alpha channel) | Gray, RGB, Indexed, RGBA | FlateDecode |
| **JPEG** | `.jpg`, `.jpeg` | Lossy (DCT) | No | Gray, RGB, CMYK | DCTDecode (passthrough) |
| **WebP** | `.webp` | Lossy (VP8) or Lossless (VP8L) | Yes (alpha) | RGB, RGBA | Re-encoded as JPEG/PNG |
| **TIFF** | `.tif`, `.tiff` | None, Deflate, JPEG, LZW, CCITT | No (per-channel only) | Gray, RGB, CMYK, Palette | Direct mapping or re-encode |

## Auto-Detection

The `embedImage()` method automatically detects the format from file headers (magic bytes):

```ts
import { createPdf } from 'modern-pdf-lib';

const doc = createPdf();
const page = doc.addPage([612, 792]);

// Works with any supported format -- PNG, JPEG, WebP, or TIFF
const image = await doc.embedImage(imageBytes);
page.drawImage(image, { x: 50, y: 400, width: 200, height: 150 });
```

You can also detect the format programmatically:

```ts
import { detectImageFormat, getImageFormatName, getSupportedFormats } from 'modern-pdf-lib';

const format = detectImageFormat(imageBytes);
// 'png' | 'jpeg' | 'webp' | 'tiff' | 'unknown'

const name = getImageFormatName(format);
// 'PNG (Portable Network Graphics)'

const all = getSupportedFormats();
// ['png', 'jpeg', 'webp', 'tiff']
```

### Magic Byte Signatures

| Format | Magic Bytes | Offset |
|--------|-------------|--------|
| PNG | `89 50 4E 47` | 0-3 |
| JPEG | `FF D8 FF` | 0-2 |
| WebP | `52 49 46 46` + `57 45 42 50` | 0-3 and 8-11 |
| TIFF (LE) | `49 49 2A 00` | 0-3 |
| TIFF (BE) | `4D 4D 00 2A` | 0-3 |

---

## PNG

PNG is the best choice for images with transparency, text overlays, or sharp edges (screenshots, diagrams, logos). PNG uses lossless compression, so there is no quality loss.

### Embedding

```ts
// Synchronous -- no async needed
const image = doc.embedPng(pngBytes);
page.drawImage(image, { x: 50, y: 400, width: 200, height: 150 });
```

### Features

- Supports all PNG color types: Grayscale, RGB, Indexed (palette), Grayscale+Alpha, RGBA
- Alpha channels are automatically separated into a PDF `/SMask` soft-mask image
- IDAT passthrough for non-alpha, non-interlaced 8-bit images (no decompression)
- Interlaced PNGs (Adam7) are fully supported
- `tRNS` transparency chunks are handled for indexed and truecolor PNGs

### When to Use PNG

- Screenshots and UI captures
- Diagrams and technical drawings
- Logos and icons with transparency
- Any image requiring exact pixel reproduction

---

## JPEG

JPEG is ideal for photographs and natural images where small file size matters more than lossless quality. JPEG data is embedded directly in PDF with zero re-encoding.

### Embedding

```ts
const image = await doc.embedJpeg(jpegBytes);
page.drawImage(image, { x: 50, y: 400, width: 300, height: 200 });
```

### Features

- Zero-copy passthrough: raw JPEG bytes become the PDF stream with `/DCTDecode`
- All SOF variants supported: Baseline (SOF0), Progressive (SOF2), Lossless (SOF3)
- CMYK JPEGs detected and embedded with `/DeviceCMYK` color space
- Adobe APP14 marker detection for YCCK color transform handling
- JFIF marker detection

### Quality Estimation

```ts
import { estimateJpegQuality } from 'modern-pdf-lib';

const quality = estimateJpegQuality(jpegBytes);
// Returns 1-100, or undefined if no DQT marker found
```

### When to Use JPEG

- Photographs and natural scenes
- Large images where file size is a concern
- Images without transparency requirements
- Scanned documents

---

## WebP

WebP is a modern format developed by Google that offers both lossy and lossless compression. Since PDF does not natively support WebP, images are decoded and re-encoded for embedding.

### Embedding

```ts
// Auto-detected by embedImage
const image = await doc.embedImage(webpBytes);

// Or explicitly
const image = await doc.embedWebP(webpBytes);
```

### Conversion Utilities

```ts
import { recompressWebP, webpToJpeg, webpToPng } from 'modern-pdf-lib';

// Re-encode decoded WebP pixels as JPEG (for PDF embedding)
const jpegBytes = recompressWebP(decodedPixels, width, height, 85);

// Full pipeline: WebP file -> JPEG file
const jpegBytes = webpToJpeg(webpFileBytes, 90);

// Full pipeline: WebP file -> PNG file (lossless)
const pngBytes = webpToPng(webpFileBytes);
```

### Features

- VP8 (lossy) and VP8L (lossless) decoding
- Alpha channel support
- Automatic re-encoding to JPEG for efficient PDF embedding
- Customizable JPEG quality for output

### When to Use WebP

- Web-sourced images already in WebP format
- Migrating web content to PDF
- Note: If you have the choice, prefer PNG or JPEG for new content since they embed more efficiently (no re-encoding needed)

---

## TIFF

TIFF is a versatile container format common in publishing, scanning, and professional photography. modern-pdf-lib supports direct embedding for many TIFF variants.

### Embedding

```ts
// Auto-detected by embedImage
const image = await doc.embedImage(tiffBytes);

// Or explicitly
const image = await doc.embedTiff(tiffBytes);
```

### Direct Embedding

For optimal performance, TIFFs with certain compression types can be mapped directly to PDF image XObjects without a decode-re-encode cycle:

```ts
import { canDirectEmbed, embedTiffDirect } from 'modern-pdf-lib';

if (canDirectEmbed(tiffBytes)) {
  const result = embedTiffDirect(tiffBytes);
  // result.data is ready for the PDF stream
  // result.filter tells you the PDF filter ('FlateDecode', 'DCTDecode', or undefined)
}
```

| TIFF Compression | PDF Filter | Re-encoding? |
|------------------|-----------|-------------|
| Uncompressed | None | No |
| Deflate | FlateDecode | No |
| JPEG-in-TIFF | DCTDecode | No |
| LZW | FlateDecode | Yes (decode + re-compress) |
| CCITT Group 3/4 | CCITTFaxDecode | Yes |

### Multi-Page TIFF

```ts
import { embedTiffDirect } from 'modern-pdf-lib';

// Embed a specific page from a multi-page TIFF
const page2 = embedTiffDirect(tiffBytes, { page: 1 }); // 0-indexed
```

### Features

- Little-endian and big-endian byte order support
- Strip-based and tile-based image organization
- Uncompressed, Deflate, JPEG, LZW, and CCITT compression
- Multi-page TIFF support
- Direct strip/tile-to-PDF mapping for zero-loss, zero-overhead embedding

### When to Use TIFF

- Scanned documents and archival content
- Professional photography (especially CMYK)
- Multi-page document imports
- Any workflow where TIFF is the source format

---

## CMYK Workflow

Both JPEG and TIFF support CMYK color spaces. PDF natively supports CMYK, so no conversion to RGB is needed for accurate color reproduction.

### CMYK Detection

```ts
import { isCmykTiff } from 'modern-pdf-lib';

// Check TIFF IFD entries for CMYK color space
const isCmyk = isCmykTiff([
  { tag: 262, value: 5 },  // PhotometricInterpretation = Separated
  { tag: 332, value: 1 },  // InkSet = CMYK
]);
```

### Native CMYK Embedding

```ts
import { embedTiffCmyk } from 'modern-pdf-lib';

// Embed CMYK pixel data directly in PDF (no RGB conversion)
const result = embedTiffCmyk(cmykPixels, width, height);
// result.colorSpace === 'DeviceCMYK'
// result.bitsPerComponent === 8
```

### CMYK to RGB Conversion

When RGB output is needed (e.g., for screen display), use the conversion function:

```ts
import { convertTiffCmykToRgb } from 'modern-pdf-lib';

const rgbPixels = convertTiffCmykToRgb(cmykPixels, width, height);
// rgbPixels: Uint8Array with 3 bytes per pixel (R, G, B)
```

The conversion uses the standard formula:

```
R = 255 * (1 - C/255) * (1 - K/255)
G = 255 * (1 - M/255) * (1 - K/255)
B = 255 * (1 - Y/255) * (1 - K/255)
```

---

## Optimization Tips

### Choose the Right Format

```
Is it a photograph?
  |-- Yes --> Use JPEG (smallest file size, DCT passthrough)
  |-- No
       |-- Does it need transparency?
       |    |-- Yes --> Use PNG (lossless, alpha support)
       |    |-- No
       |         |-- Is it a diagram/screenshot?
       |         |    |-- Yes --> Use PNG (sharp edges, lossless)
       |         |    |-- No --> Use JPEG (good enough quality)
       |
       |-- Is it already WebP?
       |    |-- Yes --> Use embedImage() (auto-converts)
       |
       |-- Is it a scanned document?
            |-- TIFF source? --> Use embedTiff() (direct mapping)
            |-- Other? --> Use JPEG or PNG based on content
```

### Performance: Direct Embedding vs Decode/Re-encode

| Approach | Speed | Quality | Supported Formats |
|----------|-------|---------|-------------------|
| **Direct passthrough** | Fastest | No loss | JPEG, PNG (no alpha, no interlace), TIFF (uncompressed, Deflate, JPEG) |
| **Decode + re-encode** | Slower | Possible loss (JPEG) | WebP, TIFF (LZW, CCITT), PNG (alpha, interlaced) |

For the fastest PDF generation, prefer formats that support direct embedding.

### Image Deduplication

When embedding the same image multiple times, use deduplication:

```ts
import { deduplicateImages } from 'modern-pdf-lib';

const report = deduplicateImages(doc);
// report.savedBytes -- bytes saved by removing duplicates
```

### Batch Optimization

For documents with many images, use batch optimization:

```ts
import { optimizeAllImages } from 'modern-pdf-lib';

const report = await optimizeAllImages(doc, {
  maxDpi: 150,
  jpegQuality: 80,
});
```

---

## API Reference Links

### Embedding Functions

- `PdfDocument.embedImage(data)` -- Auto-detect and embed any supported format
- `PdfDocument.embedPng(data)` -- Embed PNG image
- `PdfDocument.embedJpeg(data)` -- Embed JPEG image
- `PdfDocument.embedWebP(data)` -- Embed WebP image (re-encoded)
- `PdfDocument.embedTiff(data)` -- Embed TIFF image

### Format Detection

- `detectImageFormat(data)` -- Detect format from magic bytes
- `getImageFormatName(format)` -- Get human-readable format name
- `getSupportedFormats()` -- List all supported formats

### TIFF-Specific

- `canDirectEmbed(data)` -- Check if TIFF supports direct embedding
- `embedTiffDirect(data, options)` -- Direct TIFF-to-PDF mapping
- `isCmykTiff(entries)` -- Detect CMYK TIFF
- `embedTiffCmyk(pixels, w, h)` -- Native CMYK embedding
- `convertTiffCmykToRgb(pixels, w, h)` -- CMYK to RGB conversion

### WebP-Specific

- `recompressWebP(pixels, w, h, quality)` -- Re-encode as JPEG
- `webpToJpeg(webpData, quality)` -- WebP file to JPEG
- `webpToPng(webpData)` -- WebP file to PNG

### Optimization

- `estimateJpegQuality(jpegData)` -- Estimate JPEG quality from DQT
- `optimizeAllImages(doc, options)` -- Batch image optimization
- `deduplicateImages(doc)` -- Remove duplicate images
- `computeImageDpi(...)` -- Calculate effective DPI
