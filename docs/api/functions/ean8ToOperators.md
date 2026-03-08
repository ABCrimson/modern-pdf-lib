[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ean8ToOperators

# Function: ean8ToOperators()

> **ean8ToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/ean.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/ean.ts#L282)

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
