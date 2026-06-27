[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedTiffDirect

# Function: embedTiffDirect()

```ts
function embedTiffDirect(data, options?): DirectEmbedResult;
```

Defined in: [src/assets/image/tiffDirectEmbed.ts:376](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/image/tiffDirectEmbed.ts#L376)

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
