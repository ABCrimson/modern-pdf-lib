[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / showTextHex

# Function: showTextHex()

> **showTextHex**(`hex`): `string`

Defined in: [src/core/operators/text.ts:228](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/operators/text.ts#L228)

Show a text string using a hex-encoded string (`<…> Tj`).

Used for CIDFont Type 2 (TrueType) fonts where each character is
encoded as a 2-byte glyph ID in hexadecimal.

## Parameters

### hex

`string`

The hex-encoded glyph IDs (e.g. `"00480065006C006C006F"`).

## Returns

`string`
