[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / upcAToOperators

# Function: upcAToOperators()

> **upcAToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/upc.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/upc.ts#L91)

Generate PDF content-stream operators for a UPC-A barcode.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Encoded barcode from [encodeUpcA](encodeUpcA.md).

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
