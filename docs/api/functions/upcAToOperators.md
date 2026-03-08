[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / upcAToOperators

# Function: upcAToOperators()

> **upcAToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/upc.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/barcode/upc.ts#L91)

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
