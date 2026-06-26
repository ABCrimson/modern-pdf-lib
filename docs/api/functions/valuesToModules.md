[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / valuesToModules

# Function: valuesToModules()

```ts
function valuesToModules(values): BarcodeMatrix;
```

Defined in: [src/barcode/code128.ts:373](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/code128.ts#L373)

Convert a sequence of Code 128 symbol values to a module (bar/space) array.

## Parameters

### values

readonly `number`[]

Array of symbol values as returned by [encodeCode128Values](encodeCode128Values.md).

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with the module array and total width.
