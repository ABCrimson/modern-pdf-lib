[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OptimizeResult

# Interface: OptimizeResult

Defined in: [src/assets/image/imageOptimize.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L160)

The result of an optimization operation.

## Properties

### channels

> `readonly` **channels**: `number`

Defined in: [src/assets/image/imageOptimize.ts:168](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L168)

Number of channels in the output.

***

### data

> `readonly` **data**: `Uint8Array`

Defined in: [src/assets/image/imageOptimize.ts:162](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L162)

The optimized pixel data (or compressed data if recompressed).

***

### format

> `readonly` **format**: `"jpeg"` \| `"deflate"` \| `"raw"`

Defined in: [src/assets/image/imageOptimize.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L170)

The compression format applied, if any.

***

### height

> `readonly` **height**: `number`

Defined in: [src/assets/image/imageOptimize.ts:166](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L166)

Output height in pixels.

***

### wasOptimized

> `readonly` **wasOptimized**: `boolean`

Defined in: [src/assets/image/imageOptimize.ts:172](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L172)

Whether any actual optimization was performed.

***

### width

> `readonly` **width**: `number`

Defined in: [src/assets/image/imageOptimize.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/imageOptimize.ts#L164)

Output width in pixels.
