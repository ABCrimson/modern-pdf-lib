[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectImageFormat

# Function: detectImageFormat()

```ts
function detectImageFormat(data): ImageFormat;
```

Defined in: [src/assets/image/formatDetect.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/formatDetect.ts#L37)

Detect the image format from the raw file bytes by inspecting magic bytes.

## Parameters

### data

`Uint8Array`

Raw image file bytes.

## Returns

[`ImageFormat`](../type-aliases/ImageFormat.md)

The detected format, or `'unknown'` if unrecognized.
