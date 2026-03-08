[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeImageDpi

# Function: computeImageDpi()

> **computeImageDpi**(`imageWidth`, `imageHeight`, `displayWidth`, `displayHeight`): [`ImageDpi`](../interfaces/ImageDpi.md)

Defined in: [src/assets/image/dpiAnalyze.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/dpiAnalyze.ts#L57)

Compute the effective DPI of an image given its pixel dimensions
and display dimensions in points.

PDF uses 72 points per inch, so:
```
DPI = imagePixels / (displayPoints / 72)
```

## Parameters

### imageWidth

`number`

Image width in pixels.

### imageHeight

`number`

Image height in pixels.

### displayWidth

`number`

Display width in PDF points (1/72 inch).

### displayHeight

`number`

Display height in PDF points (1/72 inch).

## Returns

[`ImageDpi`](../interfaces/ImageDpi.md)

DPI information.

## Example

```ts
import { computeImageDpi } from 'modern-pdf-lib';

// A 3000×2000 image displayed at 4.17×2.78 inches (300×200 points)
const dpi = computeImageDpi(3000, 2000, 300, 200);
console.log(dpi.effectiveDpi); // 720
```
