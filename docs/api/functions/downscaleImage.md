[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / downscaleImage

# Function: downscaleImage()

> **downscaleImage**(`image`, `options?`): [`RawImageData`](../interfaces/RawImageData.md)

Defined in: [src/assets/image/imageOptimize.ts:198](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageOptimize.ts#L198)

Downscale an image to fit within the specified dimensions.

If the image is already smaller than the target dimensions, it is
returned unchanged.

## Parameters

### image

[`RawImageData`](../interfaces/RawImageData.md)

The raw image pixel data.

### options?

[`DownscaleOptions`](../interfaces/DownscaleOptions.md) = `{}`

Downscaling options (target dimensions, algorithm).

## Returns

[`RawImageData`](../interfaces/RawImageData.md)

The downscaled image, or the original if no scaling needed.

## Example

```ts
const result = downscaleImage(rawImage, {
  maxWidth: 1024,
  maxHeight: 768,
  algorithm: 'lanczos',
});
```
