[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTileRegion

# Function: decodeTileRegion()

```ts
function decodeTileRegion(data, region): Uint8Array;
```

Defined in: [src/parser/jpeg2000Tiles.ts:487](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000Tiles.ts#L487)

Decode only the tiles that intersect the given rectangular region.

This is the key API for efficient region-of-interest decoding — only
tiles overlapping the requested region are decoded, which can save
significant time for large tiled images.

The returned data covers exactly the requested region, cropped from
the relevant tiles.

## Parameters

### data

`Uint8Array`

Full JPEG2000 codestream or JP2 file bytes.

### region

`Region`

The rectangular region to decode.

## Returns

`Uint8Array`

Decoded pixel data covering the requested region.

## Throws

If the region is entirely outside the image bounds.
