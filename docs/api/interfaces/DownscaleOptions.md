[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DownscaleOptions

# Interface: DownscaleOptions

Defined in: [src/assets/image/imageOptimize.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L24)

Options for image downscaling.

## Extended by

- [`ImageOptimizeOptions`](ImageOptimizeOptions.md)

## Properties

### algorithm?

> `readonly` `optional` **algorithm**: `"nearest"` \| `"bilinear"` \| `"lanczos"`

Defined in: [src/assets/image/imageOptimize.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L56)

Resampling algorithm.
- `'nearest'`: Nearest-neighbor (fast, blocky)
- `'bilinear'`: Bilinear interpolation (good quality, moderate speed)
- `'lanczos'`: Lanczos-3 resampling (best quality, slowest)

Default: `'lanczos'`.

***

### maxHeight?

> `readonly` `optional` **maxHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L28)

Target maximum height in pixels.  The image is scaled proportionally.

***

### maxWidth?

> `readonly` `optional` **maxWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L26)

Target maximum width in pixels.  The image is scaled proportionally.

***

### printHeight?

> `readonly` `optional` **printHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L47)

Intended print height in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

***

### printWidth?

> `readonly` `optional` **printWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L42)

Intended print width in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

***

### targetDpi?

> `readonly` `optional` **targetDpi**: `number`

Defined in: [src/assets/image/imageOptimize.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L37)

Target DPI for the image at its intended print size.  If specified
along with `printWidth` / `printHeight`, the image is downscaled
to match the target DPI.

For example, a 3000×2000 image printed at 10×6.67 inches would be
300 DPI.  Setting `targetDpi: 150` would downscale to 1500×1000.
