[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / convertToGrayscale

# Function: convertToGrayscale()

> **convertToGrayscale**(`pixels`, `width`, `height`, `channels`): `Uint8Array`

Defined in: [src/assets/image/grayscaleDetect.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/grayscaleDetect.ts#L89)

Convert an RGB/RGBA image to single-channel grayscale.

Uses the ITU-R BT.601 luma formula:
```
gray = 0.299 × R + 0.587 × G + 0.114 × B
```

The alpha channel (if present) is discarded.

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

## Returns

`Uint8Array`

Grayscale pixel data (1 byte per pixel).
