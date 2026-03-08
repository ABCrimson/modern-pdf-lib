[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isGrayscaleImage

# Function: isGrayscaleImage()

> **isGrayscaleImage**(`pixels`, `width`, `height`, `channels`, `tolerance?`): `boolean`

Defined in: [src/assets/image/grayscaleDetect.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/grayscaleDetect.ts#L43)

Check whether an RGB/RGBA image is effectively grayscale.

Scans all pixels and checks if R, G, and B channels are within
`tolerance` of each other. If ≥99% of pixels pass, the image
is considered grayscale.

## Parameters

### pixels

`Uint8Array`

Raw pixel data (row-major, channel-interleaved).

### width

`number`

Image width in pixels.

### height

`number`

Image height in pixels.

### channels

Number of channels: 3 (RGB) or 4 (RGBA).

`3` | `4`

### tolerance?

`number` = `2`

Maximum allowed difference between R, G, and B
                   values for a pixel to be considered gray.
                   Default: `2`.

## Returns

`boolean`

`true` if the image is effectively grayscale.

## Example

```ts
import { isGrayscaleImage, convertToGrayscale } from 'modern-pdf-lib';

if (isGrayscaleImage(pixels, width, height, 3)) {
  const grayPixels = convertToGrayscale(pixels, width, height, 3);
  // grayPixels has 1 byte per pixel instead of 3
}
```
