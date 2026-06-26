[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiffPage

# Function: decodeTiffPage()

> **decodeTiffPage**(`data`, `pageIndex`): [`TiffImage`](../interfaces/TiffImage.md)

Defined in: [src/assets/image/tiffDecode.ts:565](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/image/tiffDecode.ts#L565)

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
