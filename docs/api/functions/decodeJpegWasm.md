[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / decodeJpegWasm

# Function: decodeJpegWasm()

> **decodeJpegWasm**(`jpegBytes`): [`JpegDecodeResult`](../interfaces/JpegDecodeResult.md) \| `undefined`

Defined in: [src/wasm/jpeg/bridge.ts:196](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/wasm/jpeg/bridge.ts#L196)

Decode JPEG bytes to raw pixel data using the WASM decoder.

The WASM module returns a flat byte array with layout:
`[width_u32_le, height_u32_le, channels_u8, ...pixels]`.

## Parameters

### jpegBytes

`Uint8Array`

JPEG-encoded image data.

## Returns

[`JpegDecodeResult`](../interfaces/JpegDecodeResult.md) \| `undefined`

Decoded pixel data with metadata, or `undefined` if WASM is not
         available or decoding failed.
