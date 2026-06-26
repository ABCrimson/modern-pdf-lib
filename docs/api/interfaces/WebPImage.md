[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WebPImage

# Interface: WebPImage

Defined in: [src/assets/image/webpDecode.ts:20](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/webpDecode.ts#L20)

Decoded WebP image data.

## Properties

### channels

```ts
readonly channels: 3 | 4;
```

Defined in: [src/assets/image/webpDecode.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/webpDecode.ts#L28)

Number of channels (3 for RGB, 4 for RGBA).

***

### hasAlpha

```ts
readonly hasAlpha: boolean;
```

Defined in: [src/assets/image/webpDecode.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/webpDecode.ts#L30)

Whether the image has an alpha channel.

***

### height

```ts
readonly height: number;
```

Defined in: [src/assets/image/webpDecode.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/webpDecode.ts#L24)

Image height in pixels.

***

### pixels

```ts
readonly pixels: Uint8Array;
```

Defined in: [src/assets/image/webpDecode.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/webpDecode.ts#L26)

Raw pixel data (RGB or RGBA).

***

### width

```ts
readonly width: number;
```

Defined in: [src/assets/image/webpDecode.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/webpDecode.ts#L22)

Image width in pixels.
