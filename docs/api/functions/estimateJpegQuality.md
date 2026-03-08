[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / estimateJpegQuality

# Function: estimateJpegQuality()

> **estimateJpegQuality**(`jpegBytes`): `number` \| `undefined`

Defined in: [src/assets/image/imageOptimize.ts:350](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/image/imageOptimize.ts#L350)

Estimate the JPEG quality level (1–100) from the quantization tables
embedded in a JPEG file.

Parses the DQT (Define Quantization Table, marker 0xFFDB) segments
from the raw JPEG bytes and compares the table values against the
standard JPEG luminance quantization table to estimate the quality
factor that was used during encoding.

If no DQT marker is found, returns `undefined`.

## Parameters

### jpegBytes

`Uint8Array`

Raw JPEG file bytes.

## Returns

`number` \| `undefined`

Estimated quality 1–100, or `undefined` if no DQT is found.

## Example

```ts
import { estimateJpegQuality } from 'modern-pdf-lib';

const quality = estimateJpegQuality(jpegBytes);
if (quality !== undefined) {
  console.log(`Estimated JPEG quality: ${quality}`);
}
```
