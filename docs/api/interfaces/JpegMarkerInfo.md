[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / JpegMarkerInfo

# Interface: JpegMarkerInfo

Defined in: [src/assets/image/jpegMarkers.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L22)

Result of JPEG marker analysis.

## Properties

### bitsPerComponent

> `readonly` **bitsPerComponent**: `number`

Defined in: [src/assets/image/jpegMarkers.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L36)

Bits per component (typically 8, sometimes 12).

***

### components

> `readonly` **components**: `number`

Defined in: [src/assets/image/jpegMarkers.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L34)

Number of color components (1=gray, 3=YCbCr, 4=CMYK).

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/jpegMarkers.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L32)

Image height in pixels.

***

### isArithmeticCoded

> `readonly` **isArithmeticCoded**: `boolean`

Defined in: [src/assets/image/jpegMarkers.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L24)

Whether the JPEG uses arithmetic coding (SOF9, SOF10, or SOF11).

***

### isProgressive

> `readonly` **isProgressive**: `boolean`

Defined in: [src/assets/image/jpegMarkers.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L26)

Whether the JPEG uses progressive encoding (SOF2 or SOF10).

***

### sofType

> `readonly` **sofType**: `number`

Defined in: [src/assets/image/jpegMarkers.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L28)

The SOF marker type (e.g. 0xC0 for baseline, 0xC2 for progressive).

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/jpegMarkers.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/jpegMarkers.ts#L30)

Image width in pixels.
