[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TiffCmykEmbedResult

# Interface: TiffCmykEmbedResult

Defined in: [src/assets/image/tiffCmyk.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffCmyk.ts#L33)

Result of embedding CMYK TIFF data for use in a PDF image XObject.

## Properties

### bitsPerComponent

> `readonly` **bitsPerComponent**: `number`

Defined in: [src/assets/image/tiffCmyk.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffCmyk.ts#L39)

Bits per component — always `8`.

***

### colorSpace

> `readonly` **colorSpace**: `string`

Defined in: [src/assets/image/tiffCmyk.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffCmyk.ts#L35)

PDF color space — always `'DeviceCMYK'`.

***

### data

> `readonly` **data**: `Uint8Array`

Defined in: [src/assets/image/tiffCmyk.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffCmyk.ts#L37)

The raw CMYK pixel data (4 channels, 8 bits per component).
