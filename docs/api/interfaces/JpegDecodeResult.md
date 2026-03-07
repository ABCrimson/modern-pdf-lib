[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / JpegDecodeResult

# Interface: JpegDecodeResult

Defined in: [src/wasm/jpeg/bridge.ts:64](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/jpeg/bridge.ts#L64)

Result of decoding a JPEG image.

## Properties

### channels

> `readonly` **channels**: `number`

Defined in: [src/wasm/jpeg/bridge.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/jpeg/bridge.ts#L72)

Number of channels (1=grayscale, 3=RGB).

***

### height

> `readonly` **height**: `number`

Defined in: [src/wasm/jpeg/bridge.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/jpeg/bridge.ts#L70)

Image height in pixels.

***

### pixels

> `readonly` **pixels**: `Uint8Array`

Defined in: [src/wasm/jpeg/bridge.ts:66](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/jpeg/bridge.ts#L66)

Raw pixel data (row-major, channel-interleaved).

***

### width

> `readonly` **width**: `number`

Defined in: [src/wasm/jpeg/bridge.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/jpeg/bridge.ts#L68)

Image width in pixels.
