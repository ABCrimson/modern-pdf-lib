[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageOptimizeOptions

# Interface: ImageOptimizeOptions

Defined in: [src/assets/image/imageOptimize.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L91)

Combined options for the full optimization pipeline.

## Extends

- [`DownscaleOptions`](DownscaleOptions.md).[`RecompressOptions`](RecompressOptions.md)

## Properties

### algorithm?

> `readonly` `optional` **algorithm**: `"nearest"` \| `"bilinear"` \| `"lanczos"`

Defined in: [src/assets/image/imageOptimize.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L57)

Resampling algorithm.
- `'nearest'`: Nearest-neighbor (fast, blocky)
- `'bilinear'`: Bilinear interpolation (good quality, moderate speed)
- `'lanczos'`: Lanczos-3 resampling (best quality, slowest)

Default: `'bilinear'`.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`algorithm`](DownscaleOptions.md#algorithm)

***

### compressionLevel?

> `readonly` `optional` **compressionLevel**: `1` \| `6` \| `3` \| `2` \| `4` \| `5` \| `7` \| `8` \| `9`

Defined in: [src/assets/image/imageOptimize.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L85)

Deflate compression level (1–9).  Only used when `format` is `'deflate'`.
Higher values produce smaller files but take longer.

Default: `6`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`compressionLevel`](RecompressOptions.md#compressionlevel)

***

### format?

> `readonly` `optional` **format**: `"deflate"` \| `"jpeg"`

Defined in: [src/assets/image/imageOptimize.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L71)

Output format.
- `'jpeg'`: JPEG compression (lossy, good for photographs)
- `'deflate'`: Deflate/zlib compression (lossless, used in PDF FlateDecode)

Default: `'deflate'`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`format`](RecompressOptions.md#format)

***

### maxHeight?

> `readonly` `optional` **maxHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L29)

Target maximum height in pixels.  The image is scaled proportionally.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`maxHeight`](DownscaleOptions.md#maxheight)

***

### maxWidth?

> `readonly` `optional` **maxWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L27)

Target maximum width in pixels.  The image is scaled proportionally.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`maxWidth`](DownscaleOptions.md#maxwidth)

***

### printHeight?

> `readonly` `optional` **printHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L48)

Intended print height in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`printHeight`](DownscaleOptions.md#printheight)

***

### printWidth?

> `readonly` `optional` **printWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L43)

Intended print width in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`printWidth`](DownscaleOptions.md#printwidth)

***

### quality?

> `readonly` `optional` **quality**: `number`

Defined in: [src/assets/image/imageOptimize.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L78)

JPEG quality (1–100).  Only used when `format` is `'jpeg'`.
Higher values produce larger files with better quality.

Default: `85`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`quality`](RecompressOptions.md#quality)

***

### skipBelowBytes?

> `readonly` `optional` **skipBelowBytes**: `number`

Defined in: [src/assets/image/imageOptimize.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L98)

Skip optimization if the input data is already smaller than this
threshold (in bytes).

Default: `0` (always optimize).

***

### targetDpi?

> `readonly` `optional` **targetDpi**: `number`

Defined in: [src/assets/image/imageOptimize.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L38)

Target DPI for the image at its intended print size.  If specified
along with `printWidth` / `printHeight`, the image is downscaled
to match the target DPI.

For example, a 3000×2000 image printed at 10×6.67 inches would be
300 DPI.  Setting `targetDpi: 150` would downscale to 1500×1000.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`targetDpi`](DownscaleOptions.md#targetdpi)
