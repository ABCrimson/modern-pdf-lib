[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DirectEmbedResult

# Interface: DirectEmbedResult

Defined in: [src/assets/image/tiffDirectEmbed.ts:103](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L103)

Result of a direct TIFF embedding operation.

## Properties

### bitsPerComponent

> `readonly` **bitsPerComponent**: `number`

Defined in: [src/assets/image/tiffDirectEmbed.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L113)

Bits per component (1, 2, 4, 8, or 16).

***

### colorSpace

> `readonly` **colorSpace**: `string`

Defined in: [src/assets/image/tiffDirectEmbed.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L111)

PDF color space name (e.g. 'DeviceRGB', 'DeviceGray', 'DeviceCMYK').

***

### data

> `readonly` **data**: `Uint8Array`

Defined in: [src/assets/image/tiffDirectEmbed.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L109)

The image data for the PDF stream.

***

### filter?

> `readonly` `optional` **filter**: `string`

Defined in: [src/assets/image/tiffDirectEmbed.ts:115](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L115)

PDF filter to use, if any (e.g. 'FlateDecode', 'DCTDecode').

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/tiffDirectEmbed.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L107)

Image height in pixels.

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/tiffDirectEmbed.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L105)

Image width in pixels.
