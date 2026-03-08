[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageOptimizeOptions

# Interface: ImageOptimizeOptions

Defined in: [src/assets/image/imageOptimize.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L114)

Combined options for the full optimization pipeline.

## Extends

- [`DownscaleOptions`](DownscaleOptions.md).[`RecompressOptions`](RecompressOptions.md)

## Properties

### algorithm?

> `readonly` `optional` **algorithm**: `"nearest"` \| `"bilinear"` \| `"lanczos"`

Defined in: [src/assets/image/imageOptimize.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L56)

Resampling algorithm.
- `'nearest'`: Nearest-neighbor (fast, blocky)
- `'bilinear'`: Bilinear interpolation (good quality, moderate speed)
- `'lanczos'`: Lanczos-3 resampling (best quality, slowest)

Default: `'lanczos'`.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`algorithm`](DownscaleOptions.md#algorithm)

***

### chromaSubsampling?

> `readonly` `optional` **chromaSubsampling**: [`ChromaSubsampling`](../type-aliases/ChromaSubsampling.md)

Defined in: [src/assets/image/imageOptimize.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L108)

Chroma subsampling mode.  Only used when `format` is `'jpeg'`.

- `'4:4:4'`: No subsampling — best color fidelity, largest file.
- `'4:2:2'`: Horizontal subsampling — good balance.
- `'4:2:0'`: Both horizontal and vertical — smallest file.

Requires the JPEG WASM module to be initialized.

Default: `'4:2:0'`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`chromaSubsampling`](RecompressOptions.md#chromasubsampling)

***

### compressionLevel?

> `readonly` `optional` **compressionLevel**: `1` \| `6` \| `3` \| `2` \| `4` \| `5` \| `7` \| `8` \| `9`

Defined in: [src/assets/image/imageOptimize.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L84)

Deflate compression level (1–9).  Only used when `format` is `'deflate'`.
Higher values produce smaller files but take longer.

Default: `6`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`compressionLevel`](RecompressOptions.md#compressionlevel)

***

### format?

> `readonly` `optional` **format**: `"jpeg"` \| `"deflate"`

Defined in: [src/assets/image/imageOptimize.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L70)

Output format.
- `'jpeg'`: JPEG compression (lossy, good for photographs)
- `'deflate'`: Deflate/zlib compression (lossless, used in PDF FlateDecode)

Default: `'deflate'`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`format`](RecompressOptions.md#format)

***

### maxHeight?

> `readonly` `optional` **maxHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L28)

Target maximum height in pixels.  The image is scaled proportionally.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`maxHeight`](DownscaleOptions.md#maxheight)

***

### maxWidth?

> `readonly` `optional` **maxWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L26)

Target maximum width in pixels.  The image is scaled proportionally.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`maxWidth`](DownscaleOptions.md#maxwidth)

***

### printHeight?

> `readonly` `optional` **printHeight**: `number`

Defined in: [src/assets/image/imageOptimize.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L47)

Intended print height in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`printHeight`](DownscaleOptions.md#printheight)

***

### printWidth?

> `readonly` `optional` **printWidth**: `number`

Defined in: [src/assets/image/imageOptimize.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L42)

Intended print width in points (1/72 inch).
Used together with `targetDpi` to compute the target pixel dimensions.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`printWidth`](DownscaleOptions.md#printwidth)

***

### progressive?

> `readonly` `optional` **progressive**: `boolean`

Defined in: [src/assets/image/imageOptimize.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L96)

Encode as progressive JPEG.  Only used when `format` is `'jpeg'`.

Progressive JPEGs render in multiple passes (low-res → full-res)
which improves perceived loading speed on slow connections.
They are also often slightly smaller than baseline JPEGs.

Requires the JPEG WASM module to be initialized.

Default: `false`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`progressive`](RecompressOptions.md#progressive)

***

### quality?

> `readonly` `optional` **quality**: `number`

Defined in: [src/assets/image/imageOptimize.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L77)

JPEG quality (1–100).  Only used when `format` is `'jpeg'`.
Higher values produce larger files with better quality.

Default: `85`.

#### Inherited from

[`RecompressOptions`](RecompressOptions.md).[`quality`](RecompressOptions.md#quality)

***

### skipBelowBytes?

> `readonly` `optional` **skipBelowBytes**: `number`

Defined in: [src/assets/image/imageOptimize.ts:121](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L121)

Skip optimization if the input data is already smaller than this
threshold (in bytes).

Default: `0` (always optimize).

***

### targetDpi?

> `readonly` `optional` **targetDpi**: `number`

Defined in: [src/assets/image/imageOptimize.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L37)

Target DPI for the image at its intended print size.  If specified
along with `printWidth` / `printHeight`, the image is downscaled
to match the target DPI.

For example, a 3000×2000 image printed at 10×6.67 inches would be
300 DPI.  Setting `targetDpi: 150` would downscale to 1500×1000.

#### Inherited from

[`DownscaleOptions`](DownscaleOptions.md).[`targetDpi`](DownscaleOptions.md#targetdpi)
