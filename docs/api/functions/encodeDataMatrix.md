[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeDataMatrix

# Function: encodeDataMatrix()

> **encodeDataMatrix**(`data`): [`DataMatrixResult`](../interfaces/DataMatrixResult.md)

Defined in: [src/barcode/dataMatrix.ts:539](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/barcode/dataMatrix.ts#L539)

Encode a string as a Data Matrix ECC200 symbol.

## Parameters

### data

`string`

The string to encode (ASCII characters supported).

## Returns

[`DataMatrixResult`](../interfaces/DataMatrixResult.md)

A [DataMatrixResult](../interfaces/DataMatrixResult.md) with the encoded symbol.

## Throws

If the data exceeds maximum capacity.
