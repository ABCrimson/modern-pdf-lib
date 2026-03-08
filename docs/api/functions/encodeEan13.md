[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeEan13

# Function: encodeEan13()

> **encodeEan13**(`data`): [`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Defined in: [src/barcode/ean.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/barcode/ean.ts#L145)

Encode an EAN-13 barcode.

## Parameters

### data

`string`

12- or 13-digit numeric string.  If 12 digits are given
             the check digit is calculated and appended.  If 13 digits
             are given the last digit is validated as the correct check.

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with 95 modules (the standard EAN-13
             symbol width without quiet zones).

## Throws

If the input is not 12 or 13 numeric digits, or if a
             provided check digit does not match.
