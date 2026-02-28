[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RawImageData

# Interface: RawImageData

Defined in: [src/assets/image/imageOptimize.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L104)

Raw image pixel data with metadata.

## Properties

### bitsPerChannel

> `readonly` **bitsPerChannel**: `number`

Defined in: [src/assets/image/imageOptimize.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L120)

Bits per channel (typically 8).

***

### channels

> `readonly` **channels**: `1` \| `2` \| `3` \| `4`

Defined in: [src/assets/image/imageOptimize.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L118)

Number of channels:
- 1: Grayscale
- 2: Grayscale + Alpha
- 3: RGB
- 4: RGBA

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/imageOptimize.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L110)

Image height in pixels.

***

### pixels

> `readonly` **pixels**: `Uint8Array`

Defined in: [src/assets/image/imageOptimize.ts:106](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L106)

Pixel data in row-major order, channel-interleaved.

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/imageOptimize.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L108)

Image width in pixels.
