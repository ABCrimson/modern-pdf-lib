[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeWebP

# Function: decodeWebP()

> **decodeWebP**(`data`): [`WebPImage`](../interfaces/WebPImage.md)

Defined in: [src/assets/image/webpDecode.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpDecode.ts#L99)

Decode a WebP image to raw pixel data.

Supports VP8 (lossy), VP8L (lossless), and VP8+ALPH (lossy with alpha).
Auto-detects the format from chunk headers.

## Parameters

### data

`Uint8Array`

Raw WebP file bytes.

## Returns

[`WebPImage`](../interfaces/WebPImage.md)

Decoded image with width, height, and pixel data.
