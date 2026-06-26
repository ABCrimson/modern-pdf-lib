[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / upcAToOperators

# Function: upcAToOperators()

```ts
function upcAToOperators(
   matrix, 
   x, 
   y, 
   options?): string;
```

Defined in: [src/barcode/upc.ts:91](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/upc.ts#L91)

Generate PDF content-stream operators for a UPC-A barcode.

## Parameters

### matrix

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Encoded barcode from [encodeUpcA](encodeUpcA.md).

### x

`number`

Lower-left x coordinate (including quiet zone).

### y

`number`

Lower-left y coordinate.

### options?

[`BarcodeOptions`](../interfaces/BarcodeOptions.md)

Rendering options.

## Returns

`string`

A string of PDF operators.
