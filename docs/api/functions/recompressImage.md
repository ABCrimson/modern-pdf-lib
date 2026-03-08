[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / recompressImage

# Function: recompressImage()

> **recompressImage**(`image`, `options?`): `Promise`\<[`OptimizeResult`](../interfaces/OptimizeResult.md)\>

Defined in: [src/assets/image/imageOptimize.ts:243](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/image/imageOptimize.ts#L243)

Recompress raw image pixel data using the specified format.

## Parameters

### image

[`RawImageData`](../interfaces/RawImageData.md)

The raw image pixel data.

### options?

[`RecompressOptions`](../interfaces/RecompressOptions.md) = `{}`

Recompression options (format, quality).

## Returns

`Promise`\<[`OptimizeResult`](../interfaces/OptimizeResult.md)\>

The compressed image data.

## Example

```ts
const result = await recompressImage(rawImage, {
  format: 'deflate',
  compressionLevel: 9,
});
```
