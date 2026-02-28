[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DownscaleOptions

# Interface: DownscaleOptions

Defined in: [src/assets/image/imageOptimize.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L25)

Options for image downscaling.

## Extended by

- [`ImageOptimizeOptions`](ImageOptimizeOptions.md)

## Properties

### algorithm?

> `readonly` `optional` **algorithm**: `"nearest"` \| `"bilinear"` \| `"lanczos"`

Defined in: [src/assets/image/imageOptimize.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L57)

Resampling algorithm.
- `'nearest'`: Nearest-neighbor (fast, blocky)
- `'bilinear'`: Bilinear interpolation (good quality, moderate speed)
- `'lanczos'`: Lanczos-3 resampling (best quality, slowest)

Default: `'bilinear'`.

***

### maxHeight?

> `readonly` `optional` **maxHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L29)

Target maximum height in pixels.  The image is scaled proportionally.

***

### maxWidth?

> `readonly` `optional` **maxWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L27)

Target maximum width in pixels.  The image is scaled proportionally.

***

### printHeight?

> `readonly` `optional` **printHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L48)

Intended print height in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

***

### printWidth?

> `readonly` `optional` **printWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L43)

Intended print width in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

***

### targetDpi?

> `readonly` `optional` **targetDpi**: `number`

Defined in: [src/assets/image/imageOptimize.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L38)

Target DPI for the image at its intended print size.  If specified
along with `printWidth` / `printHeight`, the image is downscaled
to match the target DPI.

For example, a 3000×2000 image printed at 10×6.67 inches would be
300 DPI.  Setting `targetDpi: 150` would downscale to 1500×1000.
