[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isGrayscaleImage

# Function: isGrayscaleImage()

> **isGrayscaleImage**(`pixels`, `width`, `height`, `channels`, `tolerance?`): `boolean`

Defined in: [src/assets/image/grayscaleDetect.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/grayscaleDetect.ts#L43)

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

`3` \| `4`

Number of channels: 3 (RGB) or 4 (RGBA).

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
