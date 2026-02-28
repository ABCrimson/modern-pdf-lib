[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RecompressOptions

# Interface: RecompressOptions

Defined in: [src/assets/image/imageOptimize.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L63)

Options for image recompression.

## Extended by

- [`ImageOptimizeOptions`](ImageOptimizeOptions.md)

## Properties

### compressionLevel?

> `readonly` `optional` **compressionLevel**: `1` \| `6` \| `3` \| `2` \| `4` \| `5` \| `7` \| `8` \| `9`

Defined in: [src/assets/image/imageOptimize.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L85)

Deflate compression level (1–9).  Only used when `format` is `'deflate'`.
Higher values produce smaller files but take longer.

Default: `6`.

***

### format?

> `readonly` `optional` **format**: `"deflate"` \| `"jpeg"`

Defined in: [src/assets/image/imageOptimize.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L71)

Output format.
- `'jpeg'`: JPEG compression (lossy, good for photographs)
- `'deflate'`: Deflate/zlib compression (lossless, used in PDF FlateDecode)

Default: `'deflate'`.

***

### quality?

> `readonly` `optional` **quality**: `number`

Defined in: [src/assets/image/imageOptimize.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L78)

JPEG quality (1–100).  Only used when `format` is `'jpeg'`.
Higher values produce larger files with better quality.

Default: `85`.
