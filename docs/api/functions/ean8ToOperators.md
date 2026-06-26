[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ean8ToOperators

# Function: ean8ToOperators()

> **ean8ToOperators**(`matrix`, `x`, `y`, `options?`): `string`

Defined in: [src/barcode/ean.ts:282](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/barcode/ean.ts#L282)

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
