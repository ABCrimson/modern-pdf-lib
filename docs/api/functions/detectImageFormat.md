[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectImageFormat

# Function: detectImageFormat()

```ts
function detectImageFormat(data): ImageFormat;
```

Defined in: [src/assets/image/formatDetect.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/formatDetect.ts#L37)

Detect the image format from the raw file bytes by inspecting magic bytes.

## Parameters

### data

`Uint8Array`

Raw image file bytes.

## Returns

[`ImageFormat`](../type-aliases/ImageFormat.md)

The detected format, or `'unknown'` if unrecognized.
