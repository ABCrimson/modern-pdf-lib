[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiffPage

# Function: decodeTiffPage()

```ts
function decodeTiffPage(data, pageIndex): TiffImage;
```

Defined in: [src/assets/image/tiffDecode.ts:565](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L565)

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
