[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / Pdf417Matrix

# Interface: Pdf417Matrix

Defined in: [src/barcode/pdf417.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/pdf417.ts#L47)

The result of PDF417 encoding — a 2D boolean matrix.

## Properties

### columns

> `readonly` **columns**: `number`

Defined in: [src/barcode/pdf417.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/pdf417.ts#L51)

Number of data columns.

***

### modules

> `readonly` **modules**: readonly `boolean`[]

Defined in: [src/barcode/pdf417.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/pdf417.ts#L55)

Row-major boolean array. `true` = dark bar.

***

### moduleWidth

> `readonly` **moduleWidth**: `number`

Defined in: [src/barcode/pdf417.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/pdf417.ts#L53)

Total modules per row.

***

### rows

> `readonly` **rows**: `number`

Defined in: [src/barcode/pdf417.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/pdf417.ts#L49)

Number of rows.
