[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / webpToJpeg

# Function: webpToJpeg()

> **webpToJpeg**(`webpData`, `_quality?`): `Uint8Array`

Defined in: [src/assets/image/webpOptimize.ts:776](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/webpOptimize.ts#L776)

Decode a WebP file and re-encode as JPEG.

Convenience function that combines WebP decoding with JPEG encoding.
Imports the WebP decoder dynamically from the webpDecode module
(provided by v0.24.0).

## Parameters

### webpData

`Uint8Array`

Raw WebP file bytes.

### \_quality?

`number`

## Returns

`Uint8Array`

JPEG-encoded bytes.
