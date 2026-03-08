[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ean13ToOperators

# Function: ean13ToOperators()

> **ean13ToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/ean.ts:264](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/ean.ts#L264)

Generate PDF content-stream operators for an EAN-13 barcode.

The barcode is rendered as filled rectangles (one per contiguous run
of dark modules) inside a `q … Q` graphics-state block.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Encoded barcode from [encodeEan13](encodeEan13.md).

### x

`number`

Lower-left x coordinate of the barcode (including quiet zone).

### y

`number`

Lower-left y coordinate.

### options?

[`BarcodeOptions`](../interfaces/BarcodeOptions.md)

Rendering options.

## Returns

`string`

A string of PDF operators ready to be appended to a
                content stream.
