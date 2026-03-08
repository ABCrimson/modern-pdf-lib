[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DataMatrixOptions

# Interface: DataMatrixOptions

Defined in: [src/barcode/dataMatrix.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/dataMatrix.ts#L33)

Options for rendering a Data Matrix to PDF operators.

## Properties

### backgroundColor?

> `readonly` `optional` **backgroundColor**: [`Color`](../type-aliases/Color.md)

Defined in: [src/barcode/dataMatrix.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/dataMatrix.ts#L39)

Background colour. Default: white.

***

### color?

> `readonly` `optional` **color**: [`Color`](../type-aliases/Color.md)

Defined in: [src/barcode/dataMatrix.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/dataMatrix.ts#L37)

Foreground (dark module) colour. Default: black.

***

### moduleSize?

> `readonly` `optional` **moduleSize**: `number`

Defined in: [src/barcode/dataMatrix.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/dataMatrix.ts#L35)

Size of each module in PDF points. Default: `2`.

***

### quietZone?

> `readonly` `optional` **quietZone**: `number`

Defined in: [src/barcode/dataMatrix.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/dataMatrix.ts#L41)

Number of quiet-zone modules around the code. Default: `1`.
