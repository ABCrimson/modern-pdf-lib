[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / webpToPng

# Function: webpToPng()

> **webpToPng**(`webpData`): `Uint8Array`

Defined in: [src/assets/image/webpOptimize.ts:812](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpOptimize.ts#L812)

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
