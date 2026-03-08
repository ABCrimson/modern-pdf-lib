[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WebPImage

# Interface: WebPImage

Defined in: [src/assets/image/webpDecode.ts:20](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpDecode.ts#L20)

Decoded WebP image data.

## Properties

### channels

> `readonly` **channels**: `3` \| `4`

Defined in: [src/assets/image/webpDecode.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpDecode.ts#L28)

Number of channels (3 for RGB, 4 for RGBA).

***

### hasAlpha

> `readonly` **hasAlpha**: `boolean`

Defined in: [src/assets/image/webpDecode.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpDecode.ts#L30)

Whether the image has an alpha channel.

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/webpDecode.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpDecode.ts#L24)

Image height in pixels.

***

### pixels

> `readonly` **pixels**: `Uint8Array`

Defined in: [src/assets/image/webpDecode.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpDecode.ts#L26)

Raw pixel data (RGB or RGBA).

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/webpDecode.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/webpDecode.ts#L22)

Image width in pixels.
