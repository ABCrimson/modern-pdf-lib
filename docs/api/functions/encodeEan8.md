[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeEan8

# Function: encodeEan8()

> **encodeEan8**(`data`): [`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Defined in: [src/barcode/ean.ts:200](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/barcode/ean.ts#L200)

Encode an EAN-8 barcode.

## Parameters

### data

`string`

7- or 8-digit numeric string.  If 7 digits are given
             the check digit is calculated and appended.  If 8 digits
             are given the last digit is validated.

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with 67 modules.

## Throws

If the input is invalid.
