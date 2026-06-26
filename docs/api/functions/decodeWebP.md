[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeWebP

# Function: decodeWebP()

```ts
function decodeWebP(data): WebPImage;
```

Defined in: [src/assets/image/webpDecode.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/webpDecode.ts#L99)

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
