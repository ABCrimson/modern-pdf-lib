[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / dataMatrixToOperators

# Function: dataMatrixToOperators()

> **dataMatrixToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/dataMatrix.ts:626](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/dataMatrix.ts#L626)

Convert a [DataMatrixResult](../interfaces/DataMatrixResult.md) to PDF content-stream operators.

The Data Matrix is rendered as filled rectangles (one per dark module),
positioned at `(x, y)` in PDF user-space coordinates. The `y`
coordinate refers to the **bottom-left** corner of the symbol.

## Parameters

### matrix

[`DataMatrixResult`](../interfaces/DataMatrixResult.md)

The Data Matrix from [encodeDataMatrix](encodeDataMatrix.md).

### x

`number`

X position in PDF points.

### y

`number`

Y position in PDF points.

### options?

[`DataMatrixOptions`](../interfaces/DataMatrixOptions.md) = `{}`

Rendering options (module size, quiet zone, colours).

## Returns

`string`

A string of PDF content-stream operators.
