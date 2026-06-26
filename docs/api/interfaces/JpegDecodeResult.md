[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / JpegDecodeResult

# Interface: JpegDecodeResult

Defined in: [src/wasm/jpeg/bridge.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/jpeg/bridge.ts#L45)

Result of decoding a JPEG image.

## Properties

### channels

> `readonly` **channels**: `number`

Defined in: [src/wasm/jpeg/bridge.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/jpeg/bridge.ts#L53)

Number of channels (1=grayscale, 3=RGB).

***

### height

> `readonly` **height**: `number`

Defined in: [src/wasm/jpeg/bridge.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/jpeg/bridge.ts#L51)

Image height in pixels.

***

### pixels

> `readonly` **pixels**: `Uint8Array`

Defined in: [src/wasm/jpeg/bridge.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/jpeg/bridge.ts#L47)

Raw pixel data (row-major, channel-interleaved).

***

### width

> `readonly` **width**: `number`

Defined in: [src/wasm/jpeg/bridge.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/jpeg/bridge.ts#L49)

Image width in pixels.
