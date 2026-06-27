[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / assembleTiles

# Function: assembleTiles()

```ts
function assembleTiles(tiles, gridInfo): Uint8Array;
```

Defined in: [src/parser/jpeg2000Tiles.ts:579](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000Tiles.ts#L579)

Assemble an array of decoded tiles into a full (or partial) image.

The tiles are placed onto a canvas matching the full image dimensions
described by `gridInfo`.  Missing tiles result in zero-filled regions.

## Parameters

### tiles

`TileData`[]

Array of decoded tile data.

### gridInfo

`TileGridInfo`

The tile grid geometry from [parseTileInfo](parseTileInfo.md).

## Returns

`Uint8Array`

A `Uint8Array` containing the assembled image pixels
  (interleaved components, row-major order).
