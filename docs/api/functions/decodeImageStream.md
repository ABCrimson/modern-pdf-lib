[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeImageStream

# Function: decodeImageStream()

> **decodeImageStream**(`imageInfo`): `Uint8Array`

Defined in: [src/assets/image/imageExtract.ts:281](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageExtract.ts#L281)

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
