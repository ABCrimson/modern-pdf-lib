[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchOptimizeOptions

# Interface: BatchOptimizeOptions

Defined in: [src/assets/image/batchOptimize.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L26)

Options for batch image optimization.

## Properties

### autoGrayscale?

> `readonly` `optional` **autoGrayscale**: `boolean`

Defined in: [src/assets/image/batchOptimize.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L72)

Auto-detect and convert pseudo-grayscale RGB images to true
grayscale before encoding.

Default: `false`.

***

### chromaSubsampling?

> `readonly` `optional` **chromaSubsampling**: [`ChromaSubsampling`](../type-aliases/ChromaSubsampling.md)

Defined in: [src/assets/image/batchOptimize.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L51)

Chroma subsampling mode for JPEG encoding.

Default: `'4:2:0'`.

***

### maxDpi?

> `readonly` `optional` **maxDpi**: `number`

Defined in: [src/assets/image/batchOptimize.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L39)

Maximum DPI for images.  Images exceeding this DPI at their
display size will be downscaled before recompression.

Default: `150`.

***

### minSavingsPercent?

> `readonly` `optional` **minSavingsPercent**: `number`

Defined in: [src/assets/image/batchOptimize.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L65)

Minimum savings percentage required to replace an image.
If the recompressed image is not at least this much smaller,
the original is kept.

Default: `10`.

***

### progressive?

> `readonly` `optional` **progressive**: `boolean`

Defined in: [src/assets/image/batchOptimize.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L45)

Encode as progressive JPEG.

Default: `false`.

***

### quality?

> `readonly` `optional` **quality**: `number`

Defined in: [src/assets/image/batchOptimize.ts:32](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L32)

JPEG quality (1–100) for recompressed images.

Default: `80`.

***

### skipSmallImages?

> `readonly` `optional` **skipSmallImages**: `boolean`

Defined in: [src/assets/image/batchOptimize.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L57)

Skip images smaller than this threshold (in bytes).

Default: `false` (process all images).
