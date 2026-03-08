[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / code128ToOperators

# Function: code128ToOperators()

> **code128ToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/code128.ts:432](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/barcode/code128.ts#L432)

Generate PDF content-stream operators for a Code 128 barcode.

The barcode is drawn as filled rectangles (one per bar), using the
`q`/`Q` graphics state save/restore operators for isolation.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

The barcode matrix from [encodeCode128](encodeCode128.md).

### x

`number`

X coordinate of the barcode origin (lower-left).

### y

`number`

Y coordinate of the barcode origin (lower-left).

### options?

[`Code128Options`](../interfaces/Code128Options.md)

Rendering options.

## Returns

`string`

A string of PDF content-stream operators.
