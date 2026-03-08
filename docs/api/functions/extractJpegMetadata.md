[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractJpegMetadata

# Function: extractJpegMetadata()

> **extractJpegMetadata**(`jpegBytes`): [`JpegMetadata`](../interfaces/JpegMetadata.md)

Defined in: [src/assets/image/imageMetadata.ts:330](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageMetadata.ts#L330)

Extract metadata from JPEG APP markers.

Scans after the SOI (FF D8) marker for APP markers (FF E0 through FF EF).
Extracts key metadata from JFIF (APP0) and EXIF (APP1) segments, and
collects all APP marker segments as raw bytes (excluding APP2/ICC, which
is handled separately by `iccProfile.ts`).

Scanning stops at the first non-APP marker (SOF, DQT, DHT, SOS, etc.).

## Parameters

### jpegBytes

`Uint8Array`

Raw JPEG file bytes.

## Returns

[`JpegMetadata`](../interfaces/JpegMetadata.md)

Extracted metadata with collected APP marker segments.

## Example

```ts
import { extractJpegMetadata } from 'modern-pdf-lib';

const metadata = extractJpegMetadata(jpegBytes);
console.log(`Orientation: ${metadata.orientation}`);
console.log(`DPI: ${metadata.dpiX} x ${metadata.dpiY}`);
console.log(`Copyright: ${metadata.copyright}`);
```
