[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / injectJpegMetadata

# Function: injectJpegMetadata()

> **injectJpegMetadata**(`jpegBytes`, `metadata`): `Uint8Array`

Defined in: [src/assets/image/imageMetadata.ts:450](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageMetadata.ts#L450)

Inject preserved APP markers into a recompressed JPEG.

Inserts the collected APP marker segments after the SOI (FF D8) marker
and before any existing content. This restores metadata that was
stripped during recompression.

## Parameters

### jpegBytes

`Uint8Array`

The recompressed JPEG bytes (starting with FF D8).

### metadata

[`JpegMetadata`](../interfaces/JpegMetadata.md)

The metadata extracted from the original JPEG.

## Returns

`Uint8Array`

A new Uint8Array with the APP markers injected.

## Example

```ts
import { extractJpegMetadata, injectJpegMetadata } from 'modern-pdf-lib';

// Before recompression, extract metadata from original
const metadata = extractJpegMetadata(originalJpeg);

// After recompression, inject metadata back
const recompressed = encodeJpegWasm(pixels, w, h, 3, 85);
const withMetadata = injectJpegMetadata(recompressed, metadata);
```
