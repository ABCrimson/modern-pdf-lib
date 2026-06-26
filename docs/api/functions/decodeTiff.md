[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiff

# Function: decodeTiff()

```ts
function decodeTiff(data, options?): TiffImage;
```

Defined in: [src/assets/image/tiffDecode.ts:591](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L591)

Decode a TIFF image.

## Parameters

### data

`Uint8Array`

Raw TIFF bytes.

### options?

[`TiffDecodeOptions`](../interfaces/TiffDecodeOptions.md)

Decode options (page selection).

## Returns

[`TiffImage`](../interfaces/TiffImage.md)

Decoded image data.
