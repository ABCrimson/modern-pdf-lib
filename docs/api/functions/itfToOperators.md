[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / itfToOperators

# Function: itfToOperators()

> **itfToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/itf.ts:194](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/itf.ts#L194)

Generate PDF content-stream operators for an ITF barcode.

The barcode is drawn as filled rectangles (one per contiguous bar run),
wrapped in `q`/`Q` graphics state save/restore operators. If bearer
bars are enabled, horizontal bars are drawn at the top and bottom.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

The barcode matrix from [encodeItf](encodeItf.md).

### x

`number`

X coordinate of the barcode origin (lower-left).

### y

`number`

Y coordinate of the barcode origin (lower-left).

### options?

[`ItfOptions`](../interfaces/ItfOptions.md)

Rendering options.

## Returns

`string`

A string of PDF content-stream operators.
