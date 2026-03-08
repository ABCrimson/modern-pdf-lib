[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeUpcA

# Function: encodeUpcA()

> **encodeUpcA**(`data`): [`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Defined in: [src/barcode/upc.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/upc.ts#L60)

Encode a UPC-A barcode.

UPC-A is encoded as an EAN-13 barcode with a leading `0`.  The
resulting [BarcodeMatrix](../interfaces/BarcodeMatrix.md) has 95 modules (identical to EAN-13).

## Parameters

### data

`string`

11- or 12-digit numeric string.  If 11 digits are given
             the check digit is calculated and appended.  If 12 digits
             are given the last digit is validated.

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with 95 modules.

## Throws

If the input is not 11 or 12 numeric digits, or if a
             provided check digit does not match.
