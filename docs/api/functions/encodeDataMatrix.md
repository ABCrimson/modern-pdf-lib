[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeDataMatrix

# Function: encodeDataMatrix()

```ts
function encodeDataMatrix(data): DataMatrixResult;
```

Defined in: [src/barcode/dataMatrix.ts:539](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/barcode/dataMatrix.ts#L539)

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
