[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ean8ToOperators

# Function: ean8ToOperators()

> **ean8ToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/ean.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/ean.ts#L282)

Generate PDF content-stream operators for an EAN-8 barcode.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Encoded barcode from [encodeEan8](encodeEan8.md).

### x

`number`

Lower-left x coordinate (including quiet zone).

### y

`number`

Lower-left y coordinate.

### options?

[`BarcodeOptions`](../interfaces/BarcodeOptions.md)

Rendering options.

## Returns

`string`

A string of PDF operators.
