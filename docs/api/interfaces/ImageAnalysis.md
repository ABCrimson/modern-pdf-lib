[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageAnalysis

# Interface: ImageAnalysis

Defined in: [src/assets/image/compressionAnalysis.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L26)

Per-image analysis result.

## Properties

### colorSpace

> `readonly` **colorSpace**: `string`

Defined in: [src/assets/image/compressionAnalysis.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L40)

PDF color space name (e.g. 'DeviceRGB', 'DeviceGray').

***

### currentFormat

> `readonly` **currentFormat**: `string`

Defined in: [src/assets/image/compressionAnalysis.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L38)

Description of the current encoding (e.g. 'FlateDecode', 'DCTDecode').

***

### currentSize

> `readonly` **currentSize**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L36)

Size of the current (compressed) stream data in bytes.

***

### effectiveDpi

> `readonly` **effectiveDpi**: `number` \| `undefined`

Defined in: [src/assets/image/compressionAnalysis.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L50)

Effective DPI of the image at its display size, or `undefined` if unknown.

***

### estimatedJpegSize

> `readonly` **estimatedJpegSize**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L42)

Estimated JPEG-encoded size in bytes.

***

### estimatedSavings

> `readonly` **estimatedSavings**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L44)

Estimated savings in bytes (`currentSize - estimatedJpegSize`).

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L34)

Image height in pixels.

***

### isGrayscale

> `readonly` **isGrayscale**: `boolean`

Defined in: [src/assets/image/compressionAnalysis.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L48)

Whether the image is effectively grayscale (even if stored as RGB).

***

### name

> `readonly` **name**: `string`

Defined in: [src/assets/image/compressionAnalysis.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L28)

Resource name on the page (e.g. '/Im1').

***

### pageIndex

> `readonly` **pageIndex**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L30)

Zero-based page index where this image appears.

***

### recommendation

> `readonly` **recommendation**: `"grayscale"` \| `"recompress"` \| `"keep"` \| `"downscale"`

Defined in: [src/assets/image/compressionAnalysis.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L52)

Recommended action for this image.

***

### savingsPercent

> `readonly` **savingsPercent**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L46)

Savings as a percentage of the current size.

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/compressionAnalysis.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L32)

Image width in pixels.
