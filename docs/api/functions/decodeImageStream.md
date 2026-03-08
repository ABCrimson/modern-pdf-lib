[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeImageStream

# Function: decodeImageStream()

> **decodeImageStream**(`imageInfo`): `Uint8Array`

Defined in: [src/assets/image/imageExtract.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/imageExtract.ts#L281)

Decode image stream data into raw pixels.

For DCTDecode (JPEG) streams, returns the raw JPEG bytes (not decoded
to pixels) since JPEG decoding requires the WASM module.

For FlateDecode and other filters, fully decodes the stream.

## Parameters

### imageInfo

[`ImageInfo`](../interfaces/ImageInfo.md)

An `ImageInfo` from `extractImages()`.

## Returns

`Uint8Array`

The decoded stream data.
