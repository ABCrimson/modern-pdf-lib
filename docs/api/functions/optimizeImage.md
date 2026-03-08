[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / optimizeImage

# Function: optimizeImage()

> **optimizeImage**(`image`, `options?`): `Promise`\<[`OptimizeResult`](../interfaces/OptimizeResult.md)\>

Defined in: [src/assets/image/imageOptimize.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/imageOptimize.ts#L283)

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
