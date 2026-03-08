[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / readEan8

# Function: readEan8()

> **readEan8**(`modules`): [`BarcodeReadResult`](../interfaces/BarcodeReadResult.md)

Defined in: [src/barcode/reader.ts:537](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/reader.ts#L537)

Decode an EAN-8 barcode from its module array.

EAN-8 structure (67 modules total):
- Start guard: 3 modules (101)
- Left digits (4 x 7 modules, L patterns): 28 modules
- Center guard: 5 modules (01010)
- Right digits (4 x 7 modules, R patterns): 28 modules
- End guard: 3 modules (101)

## Parameters

### modules

readonly `boolean`[]

Boolean array of 67 modules.

## Returns

[`BarcodeReadResult`](../interfaces/BarcodeReadResult.md)

A [BarcodeReadResult](../interfaces/BarcodeReadResult.md).
