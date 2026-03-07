[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeCode39CheckDigit

# Function: computeCode39CheckDigit()

> **computeCode39CheckDigit**(`data`): `string`

Defined in: [src/barcode/code39.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/barcode/code39.ts#L158)

Compute the modulo-43 check digit for a Code 39 data string.

## Parameters

### data

`string`

Uppercase data string (without start/stop `*`).

## Returns

`string`

The check digit character.

## Throws

If the data contains characters not in the Code 39 set.
