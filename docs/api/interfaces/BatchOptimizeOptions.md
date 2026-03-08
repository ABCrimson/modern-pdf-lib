[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchOptimizeOptions

# Interface: BatchOptimizeOptions

Defined in: [src/assets/image/batchOptimize.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L48)

Options for batch image optimization.

## Properties

### autoGrayscale?

> `readonly` `optional` **autoGrayscale**: `boolean`

Defined in: [src/assets/image/batchOptimize.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L94)

Auto-detect and convert pseudo-grayscale RGB images to true
grayscale before encoding.

Default: `false`.

***

### chromaSubsampling?

> `readonly` `optional` **chromaSubsampling**: [`ChromaSubsampling`](../type-aliases/ChromaSubsampling.md)

Defined in: [src/assets/image/batchOptimize.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L73)

Chroma subsampling mode for JPEG encoding.

Default: `'4:2:0'`.

***

### colorSpaces?

> `readonly` `optional` **colorSpaces**: readonly `string`[]

Defined in: [src/assets/image/batchOptimize.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L119)

Only optimize images in these color spaces
(e.g. `'DeviceRGB'`, `'DeviceCMYK'`, `'ICCBased'`).

Images in other color spaces are skipped.

***

### concurrency?

> `readonly` `optional` **concurrency**: `number`

Defined in: [src/assets/image/batchOptimize.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L134)

Maximum number of images to process concurrently.

Default: `1` (sequential).  Values less than 1 are treated as 1.

***

### maxDpi?

> `readonly` `optional` **maxDpi**: `number`

Defined in: [src/assets/image/batchOptimize.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L61)

Maximum DPI for images.  Images exceeding this DPI at their
display size will be downscaled before recompression.

Default: `150`.

***

### minImageSize?

> `readonly` `optional` **minImageSize**: `number`

Defined in: [src/assets/image/batchOptimize.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L111)

Skip images with compressed size below this threshold in bytes.

Default: `0` (no minimum).

***

### minSavingsPercent?

> `readonly` `optional` **minSavingsPercent**: `number`

Defined in: [src/assets/image/batchOptimize.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L87)

Minimum savings percentage required to replace an image.
If the recompressed image is not at least this much smaller,
the original is kept.

Default: `10`.

***

### namePattern?

> `readonly` `optional` **namePattern**: `RegExp`

Defined in: [src/assets/image/batchOptimize.ts:127](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L127)

Only optimize images whose resource name matches this pattern.

For example, `/Im[0-3]/` would only optimize images named
`/Im0` through `/Im3`.

***

### onProgress()?

> `readonly` `optional` **onProgress**: (`info`) => `void`

Defined in: [src/assets/image/batchOptimize.ts:139](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L139)

Progress callback invoked after each image is processed.

#### Parameters

##### info

[`ProgressInfo`](ProgressInfo.md)

#### Returns

`void`

***

### pageRange?

> `readonly` `optional` **pageRange**: `object`

Defined in: [src/assets/image/batchOptimize.ts:104](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L104)

Only optimize images on pages within this range (0-indexed, inclusive).

Images on pages outside this range are skipped and counted as
`skippedByFilter` in the report.

#### end

> `readonly` **end**: `number`

#### start

> `readonly` **start**: `number`

***

### progressive?

> `readonly` `optional` **progressive**: `boolean`

Defined in: [src/assets/image/batchOptimize.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L67)

Encode as progressive JPEG.

Default: `false`.

***

### quality?

> `readonly` `optional` **quality**: `number`

Defined in: [src/assets/image/batchOptimize.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L54)

JPEG quality (1–100) for recompressed images.

Default: `80`.

***

### skipSmallImages?

> `readonly` `optional` **skipSmallImages**: `boolean`

Defined in: [src/assets/image/batchOptimize.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/batchOptimize.ts#L79)

Skip images smaller than this threshold (in bytes).

Default: `false` (process all images).
