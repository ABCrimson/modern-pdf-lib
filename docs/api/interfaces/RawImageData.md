[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RawImageData

# Interface: RawImageData

Defined in: [src/assets/image/imageOptimize.ts:127](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L127)

Raw image pixel data with metadata.

## Properties

### bitsPerChannel

> `readonly` **bitsPerChannel**: `number`

Defined in: [src/assets/image/imageOptimize.ts:143](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L143)

Bits per channel (typically 8).

***

### channels

> `readonly` **channels**: `1` \| `2` \| `3` \| `4`

Defined in: [src/assets/image/imageOptimize.ts:141](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L141)

Number of channels:
- 1: Grayscale
- 2: Grayscale + Alpha
- 3: RGB
- 4: RGBA or CMYK (see `colorSpace`)

***

### colorSpace?

> `readonly` `optional` **colorSpace**: `"rgb"` \| `"cmyk"` \| `"gray"`

Defined in: [src/assets/image/imageOptimize.ts:154](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L154)

Color space of the pixel data.

- `'rgb'` — Channels are R, G, B (and optionally A).
- `'cmyk'` — Channels are C, M, Y, K (only when `channels` is 4).
  CMYK pixels are converted to RGB before JPEG encoding.
- `'gray'` — Grayscale (only when `channels` is 1 or 2).

Default: inferred from channel count (`1|2 → 'gray'`, `3|4 → 'rgb'`).

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/imageOptimize.ts:133](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L133)

Image height in pixels.

***

### pixels

> `readonly` **pixels**: `Uint8Array`

Defined in: [src/assets/image/imageOptimize.ts:129](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L129)

Pixel data in row-major order, channel-interleaved.

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/imageOptimize.ts:131](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L131)

Image width in pixels.
