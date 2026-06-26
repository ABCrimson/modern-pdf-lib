[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / valuesToModules

# Function: valuesToModules()

> **valuesToModules**(`values`): [`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Defined in: [src/barcode/code128.ts:373](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/barcode/code128.ts#L373)

Convert a sequence of Code 128 symbol values to a module (bar/space) array.

## Parameters

### values

readonly `number`[]

Array of symbol values as returned by [encodeCode128Values](encodeCode128Values.md).

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with the module array and total width.
