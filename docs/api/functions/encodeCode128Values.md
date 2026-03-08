[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / encodeCode128Values

# Function: encodeCode128Values()

> **encodeCode128Values**(`data`): readonly `number`[]

Defined in: [src/barcode/code128.ts:253](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/barcode/code128.ts#L253)

Encode a string as a sequence of Code 128 symbol values (including
START code, data symbols, code-set switches, check digit, and STOP).

## Parameters

### data

`string`

The string to encode.

## Returns

readonly `number`[]

Array of symbol values (0-106).

## Throws

If the data contains characters that cannot be encoded.
