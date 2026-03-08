[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeTargetDimensions

# Function: computeTargetDimensions()

> **computeTargetDimensions**(`imageWidth`, `imageHeight`, `displayWidth`, `displayHeight`, `maxDpi`): `object`

Defined in: [src/assets/image/dpiAnalyze.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/dpiAnalyze.ts#L90)

Compute the target pixel dimensions for downscaling an image
to a maximum DPI at a given display size.

## Parameters

### imageWidth

`number`

Current image width in pixels.

### imageHeight

`number`

Current image height in pixels.

### displayWidth

`number`

Display width in PDF points.

### displayHeight

`number`

Display height in PDF points.

### maxDpi

`number`

Maximum allowed DPI.

## Returns

`object`

Target dimensions, or the original dimensions if no
         downscaling is needed.

### downscaled

> **downscaled**: `boolean`

### height

> **height**: `number`

### width

> **width**: `number`
