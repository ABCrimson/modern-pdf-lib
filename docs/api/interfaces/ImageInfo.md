[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageInfo

# Interface: ImageInfo

Defined in: [src/assets/image/imageExtract.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L33)

Information about a single image XObject in a PDF document.

## Properties

### bitsPerComponent

> `readonly` **bitsPerComponent**: `number`

Defined in: [src/assets/image/imageExtract.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L47)

Bits per component (typically 8).

***

### channels

> `readonly` **channels**: `number`

Defined in: [src/assets/image/imageExtract.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L51)

Number of color channels (1, 3, or 4).

***

### colorSpace

> `readonly` **colorSpace**: `string`

Defined in: [src/assets/image/imageExtract.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L49)

PDF color space name (e.g. 'DeviceRGB', 'DeviceGray', 'DeviceCMYK').

***

### compressedSize

> `readonly` **compressedSize**: `number`

Defined in: [src/assets/image/imageExtract.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L55)

Size of the compressed stream data in bytes.

***

### filters

> `readonly` **filters**: readonly `string`[]

Defined in: [src/assets/image/imageExtract.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L53)

PDF filter name(s) applied to this stream.

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/imageExtract.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L45)

Image height in pixels.

***

### name

> `readonly` **name**: `string`

Defined in: [src/assets/image/imageExtract.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L39)

Resource name on the page (e.g. '/Im1').

***

### pageIndex

> `readonly` **pageIndex**: `number`

Defined in: [src/assets/image/imageExtract.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L41)

Zero-based page index where this image appears.

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/assets/image/imageExtract.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L37)

The indirect reference to this stream in the registry.

***

### stream

> `readonly` **stream**: [`PdfStream`](../classes/PdfStream.md)

Defined in: [src/assets/image/imageExtract.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L35)

The PdfStream object for this image (can be mutated for in-place optimization).

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/imageExtract.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L43)

Image width in pixels.
