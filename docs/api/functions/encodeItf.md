[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeItf

# Function: encodeItf()

```ts
function encodeItf(data, wideToNarrowRatio?): BarcodeMatrix;
```

Defined in: [src/barcode/itf.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/barcode/itf.ts#L98)

Encode a numeric string as an ITF barcode.

If the input has an odd number of digits, a leading `0` is prepended
to make it even.

## Parameters

### data

`string`

A string of digits (0-9 only).

### wideToNarrowRatio?

`number` = `3`

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with the module pattern.

## Throws

If the data contains non-digit characters.
