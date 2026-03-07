[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BarcodeMatrix

# Interface: BarcodeMatrix

Defined in: [src/barcode/types.ts:15](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/types.ts#L15)

Encoded barcode data — a sequence of modules (bars and spaces).

Each entry in `modules` is `true` for a dark bar and `false` for a
light space.  The `width` property gives the total number of modules.

## Properties

### modules

> `readonly` **modules**: readonly `boolean`[]

Defined in: [src/barcode/types.ts:17](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/types.ts#L17)

Module pattern: `true` = dark bar, `false` = light space.

***

### width

> `readonly` **width**: `number`

Defined in: [src/barcode/types.ts:19](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/types.ts#L19)

Total number of modules (= `modules.length`).
