[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / parseTileInfo

# Function: parseTileInfo()

```ts
function parseTileInfo(data): TileGridInfo;
```

Defined in: [src/parser/jpeg2000Tiles.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000Tiles.ts#L175)

Parse the SIZ marker to extract tile grid geometry.

## Parameters

### data

`Uint8Array`

A JPEG2000 codestream (raw J2K) or JP2 file.

## Returns

`TileGridInfo`

The tile grid information.

## Throws

If the SIZ marker cannot be found or is truncated.
