[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeItf

# Function: encodeItf()

> **encodeItf**(`data`, `wideToNarrowRatio?`): [`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Defined in: [src/barcode/itf.ts:98](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/barcode/itf.ts#L98)

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
