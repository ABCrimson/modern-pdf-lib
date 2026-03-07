[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / optimizeImage

# Function: optimizeImage()

> **optimizeImage**(`image`, `options?`): `Promise`\<[`OptimizeResult`](../interfaces/OptimizeResult.md)\>

Defined in: [src/assets/image/imageOptimize.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/assets/image/imageOptimize.ts#L283)

Run the full image optimization pipeline: downscale then recompress.

## Parameters

### image

[`RawImageData`](../interfaces/RawImageData.md)

The raw image pixel data.

### options?

[`ImageOptimizeOptions`](../interfaces/ImageOptimizeOptions.md) = `{}`

Combined optimization options.

## Returns

`Promise`\<[`OptimizeResult`](../interfaces/OptimizeResult.md)\>

The optimized result.
