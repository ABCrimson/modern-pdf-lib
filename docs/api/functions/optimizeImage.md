[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / optimizeImage

# Function: optimizeImage()

```ts
function optimizeImage(image, options?): Promise<OptimizeResult>;
```

Defined in: [src/assets/image/imageOptimize.ts:283](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/imageOptimize.ts#L283)

Run the full image optimization pipeline: downscale then recompress.

## Parameters

### image

[`RawImageData`](../interfaces/RawImageData.md)

The raw image pixel data.

### options?

[`ImageOptimizeOptions`](../interfaces/ImageOptimizeOptions.md) = `{}`

Combined optimization options.

## Returns

`Promise`\&lt;[`OptimizeResult`](../interfaces/OptimizeResult.md)\&gt;

The optimized result.
