[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getTiffPageCount

# Function: getTiffPageCount()

```ts
function getTiffPageCount(data): number;
```

Defined in: [src/assets/image/tiffDecode.ts:540](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/tiffDecode.ts#L540)

Get the number of pages in a multi-page TIFF.

## Parameters

### data

`Uint8Array`

Raw TIFF bytes.

## Returns

`number`

Number of IFDs (pages).
