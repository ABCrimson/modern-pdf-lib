[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeCode128

# Function: encodeCode128()

> **encodeCode128**(`data`): [`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Defined in: [src/barcode/code128.ts:404](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/code128.ts#L404)

Encode data as a Code 128 barcode.

This is the primary encoding function. It analyzes the input string,
automatically selects optimal code sets (A/B/C), calculates the
check digit, and returns the complete barcode as a module array.

## Parameters

### data

`string`

The string to encode (ASCII 0-127).

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with the module pattern.

## Throws

If the data is empty or contains non-encodable characters.
