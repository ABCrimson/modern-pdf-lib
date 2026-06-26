[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / readEan13

# Function: readEan13()

```ts
function readEan13(modules): BarcodeReadResult;
```

Defined in: [src/barcode/reader.ts:460](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/reader.ts#L460)

Decode an EAN-13 barcode from its module array.

EAN-13 structure (95 modules total):
- Start guard: 3 modules (101)
- Left digits (6 x 7 modules): 42 modules
- Center guard: 5 modules (01010)
- Right digits (6 x 7 modules): 42 modules
- End guard: 3 modules (101)

## Parameters

### modules

readonly `boolean`[]

Boolean array of 95 modules.

## Returns

[`BarcodeReadResult`](../interfaces/BarcodeReadResult.md)

A [BarcodeReadResult](../interfaces/BarcodeReadResult.md).
