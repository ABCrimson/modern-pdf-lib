[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiffPage

# Function: decodeTiffPage()

> **decodeTiffPage**(`data`, `pageIndex`): [`TiffImage`](../interfaces/TiffImage.md)

Defined in: [src/assets/image/tiffDecode.ts:566](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDecode.ts#L566)

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
