[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / webpToJpeg

# Function: webpToJpeg()

> **webpToJpeg**(`webpData`, `quality?`): `Uint8Array`

Defined in: [src/assets/image/webpOptimize.ts:776](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/webpOptimize.ts#L776)

Decode a WebP file and re-encode as JPEG.

Convenience function that combines WebP decoding with JPEG encoding.
Imports the WebP decoder dynamically from the webpDecode module
(provided by v0.24.0).

## Parameters

### webpData

`Uint8Array`

Raw WebP file bytes.

### quality?

`number`

JPEG quality (1-100). Default: 85.

## Returns

`Uint8Array`

JPEG-encoded bytes.
