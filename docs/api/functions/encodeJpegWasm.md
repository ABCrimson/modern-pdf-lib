[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeJpegWasm

# Function: encodeJpegWasm()

> **encodeJpegWasm**(`pixels`, `width`, `height`, `channels`, `quality`, `progressive?`, `chroma?`): `Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

Defined in: [src/wasm/jpeg/bridge.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/wasm/jpeg/bridge.ts#L160)

Encode raw pixel data to JPEG using the WASM encoder.

## Parameters

### pixels

`Uint8Array`

Raw pixel data (row-major, channel-interleaved).

### width

`number`

Image width in pixels.

### height

`number`

Image height in pixels.

### channels

Number of channels: 1 (grayscale), 3 (RGB), or 4 (RGBA).

`1` | `3` | `4`

### quality

`number`

JPEG quality 1–100.

### progressive?

`boolean` = `false`

Encode as progressive JPEG (default: false).

### chroma?

[`ChromaSubsampling`](../type-aliases/ChromaSubsampling.md) = `'4:2:0'`

Chroma subsampling mode (default: '4:2:0').

## Returns

`Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

JPEG-encoded bytes, or `undefined` if WASM is not available.
