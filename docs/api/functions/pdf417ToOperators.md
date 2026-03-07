[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / pdf417ToOperators

# Function: pdf417ToOperators()

> **pdf417ToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/pdf417.ts:794](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/pdf417.ts#L794)

Convert a [Pdf417Matrix](../interfaces/Pdf417Matrix.md) to PDF content-stream operators.

The barcode is rendered as filled rectangles, positioned at `(x, y)`
in PDF user-space coordinates. The `y` coordinate refers to the
**bottom-left** corner of the barcode.

## Parameters

### matrix

[`Pdf417Matrix`](../interfaces/Pdf417Matrix.md)

The PDF417 matrix from [encodePdf417](encodePdf417.md).

### x

`number`

X position in PDF points.

### y

`number`

Y position in PDF points.

### options?

[`Pdf417Options`](../interfaces/Pdf417Options.md) = `{}`

Rendering options.

## Returns

`string`

A string of PDF content-stream operators.
