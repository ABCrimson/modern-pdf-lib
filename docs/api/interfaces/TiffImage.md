[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TiffImage

# Interface: TiffImage

Defined in: [src/assets/image/tiffDecode.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffDecode.ts#L25)

Decoded TIFF image data.

## Properties

### bitsPerSample

> `readonly` **bitsPerSample**: `number`

Defined in: [src/assets/image/tiffDecode.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffDecode.ts#L35)

Original bits per sample.

***

### channels

> `readonly` **channels**: `1` \| `3` \| `4`

Defined in: [src/assets/image/tiffDecode.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffDecode.ts#L33)

Number of channels.

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/tiffDecode.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffDecode.ts#L29)

Image height in pixels.

***

### pixels

> `readonly` **pixels**: `Uint8Array`

Defined in: [src/assets/image/tiffDecode.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffDecode.ts#L31)

Raw pixel data (normalized to 8-bit per channel).

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/tiffDecode.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffDecode.ts#L27)

Image width in pixels.
