[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeDataMatrix

# Function: encodeDataMatrix()

> **encodeDataMatrix**(`data`): [`DataMatrixResult`](../interfaces/DataMatrixResult.md)

Defined in: [src/barcode/dataMatrix.ts:539](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/barcode/dataMatrix.ts#L539)

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
