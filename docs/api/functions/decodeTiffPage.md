[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiffPage

# Function: decodeTiffPage()

> **decodeTiffPage**(`data`, `pageIndex`): [`TiffImage`](../interfaces/TiffImage.md)

Defined in: [src/assets/image/tiffDecode.ts:566](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/tiffDecode.ts#L566)

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
