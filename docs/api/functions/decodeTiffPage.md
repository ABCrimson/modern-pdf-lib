[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiffPage

# Function: decodeTiffPage()

> **decodeTiffPage**(`data`, `pageIndex`): [`TiffImage`](../interfaces/TiffImage.md)

Defined in: [src/assets/image/tiffDecode.ts:566](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/tiffDecode.ts#L566)

Decode a specific page from a multi-page TIFF.

## Parameters

### data

`Uint8Array`

Raw TIFF bytes.

### pageIndex

`number`

0-based page index.

## Returns

[`TiffImage`](../interfaces/TiffImage.md)

Decoded image.
