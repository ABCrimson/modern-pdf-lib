[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OptimizeResult

# Interface: OptimizeResult

Defined in: [src/assets/image/imageOptimize.ts:126](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L126)

The result of an optimization operation.

## Properties

### channels

> `readonly` **channels**: `number`

Defined in: [src/assets/image/imageOptimize.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L134)

Number of channels in the output.

***

### data

> `readonly` **data**: `Uint8Array`

Defined in: [src/assets/image/imageOptimize.ts:128](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L128)

The optimized pixel data (or compressed data if recompressed).

***

### format

> `readonly` **format**: `"deflate"` \| `"raw"` \| `"jpeg"`

Defined in: [src/assets/image/imageOptimize.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L136)

The compression format applied, if any.

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/imageOptimize.ts:132](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L132)

Output height in pixels.

***

### wasOptimized

> `readonly` **wasOptimized**: `boolean`

Defined in: [src/assets/image/imageOptimize.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L138)

Whether any actual optimization was performed.

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/imageOptimize.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/assets/image/imageOptimize.ts#L130)

Output width in pixels.
