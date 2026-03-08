[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / showTextHex

# Function: showTextHex()

> **showTextHex**(`hex`): `string`

Defined in: [src/core/operators/text.ts:228](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/operators/text.ts#L228)

Show a text string using a hex-encoded string (`<…> Tj`).

Used for CIDFont Type 2 (TrueType) fonts where each character is
encoded as a 2-byte glyph ID in hexadecimal.

## Parameters

### hex

`string`

The hex-encoded glyph IDs (e.g. `"00480065006C006C006F"`).

## Returns

`string`
