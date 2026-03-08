[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / webpToPng

# Function: webpToPng()

> **webpToPng**(`webpData`): `Uint8Array`

Defined in: [src/assets/image/webpOptimize.ts:812](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/webpOptimize.ts#L812)

Decode a WebP file and re-encode as PNG.

Convenience function that combines WebP decoding with PNG encoding.
Produces lossless output suitable for images requiring transparency
or exact color reproduction.

## Parameters

### webpData

`Uint8Array`

Raw WebP file bytes.

## Returns

`Uint8Array`

PNG-encoded bytes.
