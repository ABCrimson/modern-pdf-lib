[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DirectEmbedResult

# Interface: DirectEmbedResult

Defined in: [src/assets/image/tiffDirectEmbed.ts:100](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDirectEmbed.ts#L100)

Result of a direct TIFF embedding operation.

## Properties

### bitsPerComponent

> `readonly` **bitsPerComponent**: `number`

Defined in: [src/assets/image/tiffDirectEmbed.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDirectEmbed.ts#L110)

Bits per component (1, 2, 4, 8, or 16).

***

### colorSpace

> `readonly` **colorSpace**: `string`

Defined in: [src/assets/image/tiffDirectEmbed.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDirectEmbed.ts#L108)

PDF color space name (e.g. 'DeviceRGB', 'DeviceGray', 'DeviceCMYK').

***

### data

> `readonly` **data**: `Uint8Array`

Defined in: [src/assets/image/tiffDirectEmbed.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDirectEmbed.ts#L106)

The image data for the PDF stream.

***

### filter?

> `readonly` `optional` **filter?**: `string`

Defined in: [src/assets/image/tiffDirectEmbed.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDirectEmbed.ts#L112)

PDF filter to use, if any (e.g. 'FlateDecode', 'DCTDecode').

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/tiffDirectEmbed.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDirectEmbed.ts#L104)

Image height in pixels.

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/tiffDirectEmbed.ts:102](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDirectEmbed.ts#L102)

Image width in pixels.
