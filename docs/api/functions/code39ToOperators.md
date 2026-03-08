[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / code39ToOperators

# Function: code39ToOperators()

> **code39ToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/code39.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/barcode/code39.ts#L269)

Generate PDF content-stream operators for a Code 39 barcode.

The barcode is drawn as filled rectangles (one per contiguous bar run),
wrapped in `q`/`Q` graphics state save/restore operators.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

The barcode matrix from [encodeCode39](encodeCode39.md).

### x

`number`

X coordinate of the barcode origin (lower-left).

### y

`number`

Y coordinate of the barcode origin (lower-left).

### options?

[`Code39Options`](../interfaces/Code39Options.md)

Rendering options.

## Returns

`string`

A string of PDF content-stream operators.
