[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiff

# Function: decodeTiff()

```ts
function decodeTiff(data, options?): TiffImage;
```

Defined in: [src/assets/image/tiffDecode.ts:591](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/tiffDecode.ts#L591)

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
