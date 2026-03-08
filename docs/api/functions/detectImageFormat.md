[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectImageFormat

# Function: detectImageFormat()

> **detectImageFormat**(`data`): [`ImageFormat`](../type-aliases/ImageFormat.md)

Defined in: [src/assets/image/formatDetect.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/formatDetect.ts#L37)

Detect the image format from the raw file bytes by inspecting magic bytes.

## Parameters

### data

`Uint8Array`

Raw image file bytes.

## Returns

[`ImageFormat`](../type-aliases/ImageFormat.md)

The detected format, or `'unknown'` if unrecognized.
