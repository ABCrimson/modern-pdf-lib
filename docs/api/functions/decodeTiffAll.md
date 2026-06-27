[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiffAll

# Function: decodeTiffAll()

```ts
function decodeTiffAll(data): TiffImage[];
```

Defined in: [src/assets/image/tiffDecode.ts:575](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/tiffDecode.ts#L575)

Decode all pages from a multi-page TIFF.

## Parameters

### data

`Uint8Array`

Raw TIFF bytes.

## Returns

[`TiffImage`](../interfaces/TiffImage.md)[]

Array of decoded images.
