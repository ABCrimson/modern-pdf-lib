[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedTiffCmyk

# Function: embedTiffCmyk()

> **embedTiffCmyk**(`pixels`, `width`, `height`): [`TiffCmykEmbedResult`](../interfaces/TiffCmykEmbedResult.md)

Defined in: [src/assets/image/tiffCmyk.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffCmyk.ts#L120)

Prepare CMYK pixel data for native embedding in a PDF using /DeviceCMYK.

PDF natively supports CMYK color spaces, so no RGB conversion is
needed — the raw CMYK data can be used directly as the image stream.

## Parameters

### pixels

`Uint8Array`

Flat array of CMYK pixel data (4 bytes per pixel: C, M, Y, K).

### width

`number`

Image width in pixels.

### height

`number`

Image height in pixels.

## Returns

[`TiffCmykEmbedResult`](../interfaces/TiffCmykEmbedResult.md)

Embedding result with colorSpace, data, and bitsPerComponent.

## Throws

If the input array length does not match width * height * 4.
