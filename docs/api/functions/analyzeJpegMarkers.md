[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / analyzeJpegMarkers

# Function: analyzeJpegMarkers()

> **analyzeJpegMarkers**(`data`): [`JpegMarkerInfo`](../interfaces/JpegMarkerInfo.md) \| `undefined`

Defined in: [src/assets/image/jpegMarkers.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/jpegMarkers.ts#L90)

Parse JPEG markers to detect arithmetic coding and other properties.
Scans marker segments without decoding image data.

## Parameters

### data

`Uint8Array`

Raw JPEG bytes (must start with FF D8).

## Returns

[`JpegMarkerInfo`](../interfaces/JpegMarkerInfo.md) \| `undefined`

Marker info, or `undefined` if not valid JPEG.

## Example

```ts
import { analyzeJpegMarkers } from 'modern-pdf-lib';

const info = analyzeJpegMarkers(jpegBytes);
if (info?.isArithmeticCoded) {
  console.log('Cannot re-encode: arithmetic-coded JPEG');
}
```
