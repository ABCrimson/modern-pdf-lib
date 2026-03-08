[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / readCode39

# Function: readCode39()

> **readCode39**(`modules`): [`BarcodeReadResult`](../interfaces/BarcodeReadResult.md)

Defined in: [src/barcode/reader.ts:682](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/reader.ts#L682)

Decode a Code 39 barcode from its module array.

The reader dynamically determines the wide/narrow threshold from
the module widths, making it robust to different ratios.

## Parameters

### modules

readonly `boolean`[]

Boolean array where `true` = dark bar.

## Returns

[`BarcodeReadResult`](../interfaces/BarcodeReadResult.md)

A [BarcodeReadResult](../interfaces/BarcodeReadResult.md) with the decoded data.
