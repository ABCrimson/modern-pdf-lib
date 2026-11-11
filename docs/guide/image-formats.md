# Image Format Support

modern-pdf-lib supports embedding images in all major raster formats. Each format is handled optimally for PDF output -- direct passthrough where possible, lossless conversion where necessary.

## Overview

| Format | Extension | Compression | Transparency | Color Spaces | PDF Embedding |
|--------|-----------|-------------|--------------|--------------|---------------|
| **PNG** | `.png` | Lossless (Deflate) | Yes (alpha channel) | Gray, RGB, Indexed, RGBA | FlateDecode |
| **JPEG** | `.jpg`, `.jpeg` | Lossy (DCT) | No | Gray, RGB, CMYK | DCTDecode (passthrough) |
| **WebP** | `.webp` | Lossy (VP8) or Lossless (VP8L) | Yes (alpha) | RGB, RGBA | Decoded; FlateDecode RGB (+ `/SMask` for alpha) |
| **TIFF** | `.tif`, `.tiff` | None, PackBits, LZW, Deflate, JPEG | Alpha from a 4th sample | Gray, RGB, RGBA (`embedTiff`); CMYK via `embedTiffDirect` (see [TIFF](#tiff)) | Decoded + FlateDecode (`embedTiff`) or passthrough (`embedTiffDirect`) |

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
// Async -- await the embed
const image = await doc.embedPng(pngBytes);
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
- Baseline (SOF0) and progressive (SOF2) JPEGs
- 1, 3 and 4 components map to `/DeviceGray`, `/DeviceRGB` and `/DeviceCMYK`
- Adobe (APP14) CMYK/YCCK JPEGs are not detected; they may render inverted

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

WebP is a modern format developed by Google that offers both lossy and lossless compression. Since PDF does not natively support WebP, images are decoded to RGB(A) pixels and stored losslessly with FlateDecode. Lossy WebP decodes to a flat grey placeholder; lossless and alpha decode.

### Embedding

```ts
// Auto-detected by embedImage
const image = await doc.embedImage(webpBytes);

// Or explicitly
const image = await doc.embedWebP(webpBytes);
```

### Conversion Utilities

```ts
import { recompressWebP } from 'modern-pdf-lib';

// Re-encode decoded WebP pixels as JPEG
const jpegBytes = recompressWebP(decodedPixels, width, height, 85);
```

### Features

- VP8L (lossless) decoding; VP8 (lossy) decodes to a flat grey placeholder
- Alpha channel support
- Decoded pixels stored losslessly (FlateDecode); alpha becomes a soft mask
- `recompressWebP()` encodes decoded pixels as JPEG with a quality setting; `embedWebP()` does not use it

### When to Use WebP

- Web-sourced images already in WebP format
- Migrating web content to PDF
- Note: If you have the choice, prefer JPEG, or 8-bit PNG without alpha, `tRNS` transparency or interlacing, for new content: they embed without decoding to raw pixels

---

## TIFF

TIFF is a versatile container format common in publishing, scanning, and professional photography. modern-pdf-lib embeds TIFFs by decoding them (`embedTiff`) or, for some variants, by direct passthrough (`embedTiffDirect`).

### Embedding

```ts
// Auto-detected by embedImage
const image = await doc.embedImage(tiffBytes);

// Or explicitly
const image = await doc.embedTiff(tiffBytes);
```

`embedTiff()` decodes every TIFF to 8-bit pixels and re-compresses them with FlateDecode. It treats a 1-sample TIFF as `/DeviceGray` and a 4-sample TIFF as RGB plus alpha, so CMYK and palette TIFFs come out with wrong colours.

### Direct Embedding

TIFFs with certain compression types can be mapped directly to PDF image XObjects without a decode-re-encode cycle:

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
| LZW, PackBits | FlateDecode (via `embedTiff`) | Yes (decode + re-compress) |

Direct passthrough is reliable for uncompressed TIFFs and single-strip Deflate TIFFs without a predictor. Deflate TIFFs with several strips or tiles, or with a predictor, are not reassembled and can produce a wrong image.

### Multi-Page TIFF

```ts
import { embedTiffDirect } from 'modern-pdf-lib';

// Embed a specific page from a multi-page TIFF
const page2 = embedTiffDirect(tiffBytes, { page: 1 }); // 0-indexed
```

### Features

- Little-endian and big-endian byte order support
- Strip-based and tile-based image organization
- Uncompressed, PackBits, LZW, Deflate and JPEG compression (CCITT is not supported)
- Multi-page TIFF support
- Direct strip/tile-to-PDF mapping for uncompressed and single-strip Deflate TIFFs

### When to Use TIFF

- Scanned documents and archival content
- Professional photography
- Multi-page document imports
- Any workflow where TIFF is the source format

---

## CMYK Workflow

Both JPEG and TIFF support CMYK color spaces. PDF natively supports CMYK, so no conversion to RGB is needed for accurate color reproduction. `embedTiff()` does not preserve CMYK: it embeds 4-sample TIFFs as RGB plus alpha.

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
       |    |-- Yes --> Use embedImage() (decodes to RGB)
       |
       |-- Is it a scanned document?
            |-- TIFF source? --> canDirectEmbed() ? embedTiffDirect() : embedTiff() (decode + FlateDecode)
            |-- Other? --> Use JPEG or PNG based on content
```

### Performance: Direct Embedding vs Decode/Re-encode

| Approach | Speed | Quality | Supported Formats |
|----------|-------|---------|-------------------|
| **Direct passthrough** | Fastest | No loss | JPEG, PNG (no alpha, no interlace), TIFF (uncompressed, single-strip Deflate without predictor, JPEG) |
| **Decode + Flate** | Slower | Lossless (decoded pixels) | WebP, TIFF (LZW, PackBits), PNG (alpha, interlaced) |

For the fastest PDF generation, prefer formats that support direct embedding.

### Image Deduplication

When embedding the same image multiple times, use deduplication:

```ts
import { deduplicateImages } from 'modern-pdf-lib';

const report = deduplicateImages(doc);
// report.bytesSaved -- bytes saved by removing duplicates
```

### Batch Optimization

For documents with many images, use batch optimization:

```ts
import { optimizeAllImages } from 'modern-pdf-lib';

const report = await optimizeAllImages(doc, {
  quality: 80,
});
```

Recompression needs the JPEG WASM encoder, which the library does not load by itself; see [Image Optimization](./image-optimization.md).

## Next-generation formats (AVIF, HEIC, JPEG XL)

AVIF (AV1), HEIC (HEVC), and JPEG XL are modern codecs whose **decoders are far
too large to bundle in a pure-JS, single-dependency library** (the same reason
WOFF2/Brotli is not bundled). modern-pdf-lib therefore *detects and probes*
these formats — so the library recognises them and fails clearly instead of
mis-embedding garbage — and gives you a clean way to plug in a real decoder.

### Detecting & probing

```ts
import { detectNextGenFormat, probeNextGenImage } from 'modern-pdf-lib';

detectNextGenFormat(bytes); // 'avif' | 'heic' | 'heif' | 'jpegxl' | null

const info = probeNextGenImage(bytes);
// { format: 'avif', width: 1920, height: 1080, decodable: false,
//   reason: 'AVIF detected; … convert to PNG/JPEG or register a WASM decoder' }
```

Detection follows the ISOBMFF brands (`ftyp`) and JPEG XL signatures; dimensions
for AVIF/HEIC come from the `ispe` box. `decodable` is **always `false`** — these
functions never produce pixels, and `reason` tells you what to do next. (JPEG XL
dimensions are not parsed; only the format is reported.)

### Plugging in a decoder

To actually rasterize these formats, register a decoder (e.g. a WASM `libheif`/
`libjxl`/`dav1d` build, or the browser `ImageDecoder` Web API):

```ts
import { registerImageDecoder, decodeRegisteredImage } from 'modern-pdf-lib';

registerImageDecoder('avif', async (bytes) => {
  const { width, height, rgba } = await myWasmAvifDecoder(bytes); // your codec
  return { width, height, rgba }; // RGBA8888, length === width*height*4
});

const image = await decodeRegisteredImage('avif', bytes); // → { width, height, rgba }
```

The registry validates that the decoder returns a well-formed RGBA buffer
(`rgba.length === width * height * 4`) and throws a clear error otherwise. The
library performs no decoding itself — this is purely the dispatch layer.

## SVG filter effects

For SVG-to-PDF and raster pipelines, modern-pdf-lib implements the common SVG 1.1
filter primitives over straight RGBA8888 buffers:

```ts
import {
  feGaussianBlur, feColorMatrix, feColorMatrixSaturate,
  feOffset, feFlood, feBlend, feComposite,
} from 'modern-pdf-lib';

const blurred = feGaussianBlur(buffer, 3);          // 3-box-blur Gaussian (SVG §15.17)
const grey = feColorMatrixSaturate(buffer, 0);      // desaturate
const shifted = feOffset(buffer, 4, 4);
const over = feComposite(top, bottom, 'over');      // Porter-Duff
const lit = feBlend(a, b, 'screen');
```

Each takes/returns a `RasterBuffer` (`{ width, height, rgba }`). The blur uses
the SVG-recommended three-successive-box-blur approximation; `feComposite`
implements the Porter-Duff `over`/`in`/`out`/`atop`/`xor` operators; the colour
matrix and blend modes follow SVG 1.1 §15.

---

## API Reference Links

### Embedding Functions

- `PdfDocument.embedImage(data)` -- Auto-detect and embed any supported format
- `PdfDocument.embedPng(data)` -- Embed PNG image
- `PdfDocument.embedJpeg(data)` -- Embed JPEG image
- `PdfDocument.embedWebP(data)` -- Embed WebP image (decoded, FlateDecode)
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

- `recompressWebP(pixels, w, h, quality)` -- Re-encode decoded pixels as JPEG

### Optimization

- `estimateJpegQuality(jpegData)` -- Estimate JPEG quality from DQT
- `optimizeAllImages(doc, options)` -- Batch image optimization
- `deduplicateImages(doc)` -- Remove duplicate images
- `computeImageDpi(...)` -- Calculate effective DPI
