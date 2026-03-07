[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DataMatrixResult

# Interface: DataMatrixResult

Defined in: [src/barcode/dataMatrix.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/dataMatrix.ts#L45)

The result of Data Matrix encoding — a boolean matrix.

## Properties

### cols

> `readonly` **cols**: `number`

Defined in: [src/barcode/dataMatrix.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/dataMatrix.ts#L49)

Number of columns in the symbol.

***

### modules

> `readonly` **modules**: readonly `boolean`[]

Defined in: [src/barcode/dataMatrix.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/dataMatrix.ts#L51)

Row-major boolean array. `true` = dark module.

***

### rows

> `readonly` **rows**: `number`

Defined in: [src/barcode/dataMatrix.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/dataMatrix.ts#L47)

Number of rows in the symbol.
