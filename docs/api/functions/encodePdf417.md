[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodePdf417

# Function: encodePdf417()

```ts
function encodePdf417(data, options?): Pdf417Matrix;
```

Defined in: [src/barcode/pdf417.ts:678](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/pdf417.ts#L678)

Encode a string as a PDF417 2D stacked barcode.

## Parameters

### data

`string`

The string to encode.

### options?

Encoding options (columns, error level).

#### columns?

`number`

#### errorLevel?

`number`

## Returns

[`Pdf417Matrix`](../interfaces/Pdf417Matrix.md)

A [Pdf417Matrix](../interfaces/Pdf417Matrix.md) with the encoded barcode.

## Throws

If the data is empty or too long to encode.
