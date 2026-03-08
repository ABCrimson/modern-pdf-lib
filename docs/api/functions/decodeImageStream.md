[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeImageStream

# Function: decodeImageStream()

> **decodeImageStream**(`imageInfo`): `Uint8Array`

Defined in: [src/assets/image/imageExtract.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/assets/image/imageExtract.ts#L281)

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
