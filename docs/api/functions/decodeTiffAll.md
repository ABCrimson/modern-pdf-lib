[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTiffAll

# Function: decodeTiffAll()

```ts
function decodeTiffAll(data): TiffImage[];
```

Defined in: [src/assets/image/tiffDecode.ts:575](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L575)

Decode all pages from a multi-page TIFF.

## Parameters

### data

`Uint8Array`

Raw TIFF bytes.

## Returns

[`TiffImage`](../interfaces/TiffImage.md)[]

Array of decoded images.
