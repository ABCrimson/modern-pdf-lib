[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeDataMatrix

# Function: encodeDataMatrix()

> **encodeDataMatrix**(`data`): [`DataMatrixResult`](../interfaces/DataMatrixResult.md)

Defined in: [src/barcode/dataMatrix.ts:539](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/barcode/dataMatrix.ts#L539)

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
