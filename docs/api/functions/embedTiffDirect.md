[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedTiffDirect

# Function: embedTiffDirect()

> **embedTiffDirect**(`data`, `options?`): [`DirectEmbedResult`](../interfaces/DirectEmbedResult.md)

Defined in: [src/assets/image/tiffDirectEmbed.ts:380](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/tiffDirectEmbed.ts#L380)

Directly embed a TIFF image in a PDF image XObject.

For supported compression types, this avoids the decode-re-encode
cycle by mapping TIFF strips/tiles directly to PDF stream data:

- **Uncompressed**: Raw pixel data used with no filter.
- **Deflate**: Compressed data passed through as FlateDecode.
- **JPEG-in-TIFF**: JPEG data extracted and used as DCTDecode.

## Parameters

### data

`Uint8Array`

Raw TIFF file bytes.

### options?

[`DirectEmbedOptions`](../interfaces/DirectEmbedOptions.md)

Optional settings (page index for multi-page TIFFs).

## Returns

[`DirectEmbedResult`](../interfaces/DirectEmbedResult.md)

The embedding result with all data needed for a PDF image XObject.

## Throws

If the TIFF format does not support direct embedding.
