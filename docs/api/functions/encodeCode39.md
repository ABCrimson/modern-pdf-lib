[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeCode39

# Function: encodeCode39()

> **encodeCode39**(`data`, `includeCheckDigit?`, `wideToNarrowRatio?`): [`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

Defined in: [src/barcode/code39.ts:190](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code39.ts#L190)

Encode a string as a Code 39 barcode.

The input is automatically wrapped with start/stop `*` characters.
If `includeCheckDigit` is true, a modulo-43 check digit is appended
before the stop character.

## Parameters

### data

`string`

The string to encode (digits, uppercase A-Z,
                          space, `-`, `.`, `$`, `/`, `+`, `%`).

### includeCheckDigit?

`boolean` = `false`

Whether to append a modulo-43 check digit.
                          Default: `false`.

### wideToNarrowRatio?

`number` = `3`

Wide-to-narrow ratio for module expansion.
                          Default: `3`.

## Returns

[`BarcodeMatrix`](../interfaces/BarcodeMatrix.md)

A [BarcodeMatrix](../interfaces/BarcodeMatrix.md) with the module pattern.

## Throws

If the data contains invalid characters (lowercase,
                          `*`, or characters outside the Code 39 set).
