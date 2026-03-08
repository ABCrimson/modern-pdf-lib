[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeWebP

# Function: decodeWebP()

> **decodeWebP**(`data`): [`WebPImage`](../interfaces/WebPImage.md)

Defined in: [src/assets/image/webpDecode.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/webpDecode.ts#L99)

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
