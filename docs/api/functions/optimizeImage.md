[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / optimizeImage

# Function: optimizeImage()

> **optimizeImage**(`image`, `options?`): `Promise`\<[`OptimizeResult`](../interfaces/OptimizeResult.md)\>

Defined in: [src/assets/image/imageOptimize.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/imageOptimize.ts#L283)

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
