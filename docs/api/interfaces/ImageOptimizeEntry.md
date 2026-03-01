[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ImageOptimizeEntry

# Interface: ImageOptimizeEntry

Defined in: [src/assets/image/batchOptimize.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L78)

Per-image optimization report entry.

## Properties

### name

> `readonly` **name**: `string`

Defined in: [src/assets/image/batchOptimize.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L80)

Resource name (e.g. '/Im1').

***

### newSize

> `readonly` **newSize**: `number`

Defined in: [src/assets/image/batchOptimize.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L86)

New compressed size in bytes (same as original if skipped).

***

### originalSize

> `readonly` **originalSize**: `number`

Defined in: [src/assets/image/batchOptimize.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L84)

Original compressed size in bytes.

***

### pageIndex

> `readonly` **pageIndex**: `number`

Defined in: [src/assets/image/batchOptimize.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L82)

Page index where this image appears.

***

### reason?

> `readonly` `optional` **reason**: `string`

Defined in: [src/assets/image/batchOptimize.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L90)

Reason for skipping, if applicable.

***

### skipped

> `readonly` **skipped**: `boolean`

Defined in: [src/assets/image/batchOptimize.ts:88](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/batchOptimize.ts#L88)

Whether this image was skipped.
