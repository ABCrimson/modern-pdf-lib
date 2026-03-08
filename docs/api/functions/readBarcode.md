[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / readBarcode

# Function: readBarcode()

> **readBarcode**(`modules`): [`BarcodeReadResult`](../interfaces/BarcodeReadResult.md) \| `null`

Defined in: [src/barcode/reader.ts:752](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/barcode/reader.ts#L752)

Auto-detect barcode format and decode.

Tries multiple decoders and returns the first successful result,
or `null` if no format matches.

Detection order:
1. EAN-13 (95 modules)
2. EAN-8 (67 modules)
3. Code 128 (starts with a known START pattern)
4. Code 39 (starts and ends with '*' pattern)

## Parameters

### modules

readonly `boolean`[]

Boolean array where `true` = dark bar.

## Returns

[`BarcodeReadResult`](../interfaces/BarcodeReadResult.md) \| `null`

A [BarcodeReadResult](../interfaces/BarcodeReadResult.md) or `null` if unrecognised.
