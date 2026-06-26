[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeCode128

# Function: encodeCode128()

```ts
function encodeCode128(data): BarcodeMatrix;
```

Defined in: [src/barcode/code128.ts:404](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code128.ts#L404)

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
