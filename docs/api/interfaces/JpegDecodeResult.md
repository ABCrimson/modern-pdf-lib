[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / JpegDecodeResult

# Interface: JpegDecodeResult

Defined in: [src/wasm/jpeg/bridge.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/jpeg/bridge.ts#L45)

Result of decoding a JPEG image.

## Properties

### channels

```ts
readonly channels: number;
```

Defined in: [src/wasm/jpeg/bridge.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/jpeg/bridge.ts#L53)

Number of channels (1=grayscale, 3=RGB).

***

### height

```ts
readonly height: number;
```

Defined in: [src/wasm/jpeg/bridge.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/jpeg/bridge.ts#L51)

Image height in pixels.

***

### pixels

```ts
readonly pixels: Uint8Array;
```

Defined in: [src/wasm/jpeg/bridge.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/jpeg/bridge.ts#L47)

Raw pixel data (row-major, channel-interleaved).

***

### width

```ts
readonly width: number;
```

Defined in: [src/wasm/jpeg/bridge.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/jpeg/bridge.ts#L49)

Image width in pixels.
