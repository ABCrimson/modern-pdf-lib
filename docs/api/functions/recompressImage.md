[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / recompressImage

# Function: recompressImage()

```ts
function recompressImage(image, options?): Promise<OptimizeResult>;
```

Defined in: [src/assets/image/imageOptimize.ts:243](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/imageOptimize.ts#L243)

Recompress raw image pixel data using the specified format.

## Parameters

### image

[`RawImageData`](../interfaces/RawImageData.md)

The raw image pixel data.

### options?

[`RecompressOptions`](../interfaces/RecompressOptions.md) = `{}`

Recompression options (format, quality).

## Returns

`Promise`\&lt;[`OptimizeResult`](../interfaces/OptimizeResult.md)\&gt;

The compressed image data.

## Example

```ts
const result = await recompressImage(rawImage, {
  format: 'deflate',
  compressionLevel: 9,
});
```
