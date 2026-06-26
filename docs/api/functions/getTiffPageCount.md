[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getTiffPageCount

# Function: getTiffPageCount()

```ts
function getTiffPageCount(data): number;
```

Defined in: [src/assets/image/tiffDecode.ts:540](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/tiffDecode.ts#L540)

Get the number of pages in a multi-page TIFF.

## Parameters

### data

`Uint8Array`

Raw TIFF bytes.

## Returns

`number`

Number of IFDs (pages).
