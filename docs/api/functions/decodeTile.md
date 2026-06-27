[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeTile

# Function: decodeTile()

```ts
function decodeTile(data, tileIndex): TileData;
```

Defined in: [src/parser/jpeg2000Tiles.ts:408](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/jpeg2000Tiles.ts#L408)

Decode a single tile from a JPEG2000 codestream.

This extracts the tile data for the given tile index by locating its
SOT marker(s) in the codestream.  The actual decoding produces
uncompressed pixel data for that tile.

Note: Full wavelet / entropy decoding of JPEG2000 tile data is
extremely complex.  This implementation provides the tile extraction
and framing layer.  For production use, the WASM bridge should be
used for the actual decompression.  When WASM is not available, this
returns a zero-filled buffer matching the tile dimensions (useful for
layout / testing purposes).

## Parameters

### data

`Uint8Array`

Full JPEG2000 codestream or JP2 file bytes.

### tileIndex

`number`

Zero-based tile index (row-major order).

## Returns

`TileData`

Decoded tile data.

## Throws

If the tile index is out of range or the codestream is invalid.
