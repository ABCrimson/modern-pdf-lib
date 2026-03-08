[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / readCode128

# Function: readCode128()

> **readCode128**(`modules`): [`BarcodeReadResult`](../interfaces/BarcodeReadResult.md)

Defined in: [src/barcode/reader.ts:258](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/reader.ts#L258)

Decode a Code 128 barcode from its module array.

Finds the START pattern, decodes symbols according to the active
code set, verifies the check digit, and finds the STOP pattern.

## Parameters

### modules

readonly `boolean`[]

Boolean array where `true` = dark bar.

## Returns

[`BarcodeReadResult`](../interfaces/BarcodeReadResult.md)

A [BarcodeReadResult](../interfaces/BarcodeReadResult.md) with the decoded data.
