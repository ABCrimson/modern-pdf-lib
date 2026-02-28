[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / showTextArray

# Function: showTextArray()

> **showTextArray**(`items`): `string`

Defined in: [src/core/operators/text.ts:242](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/operators/text.ts#L242)

Show one or more text strings with individual glyph positioning (`TJ`).

Each element of `items` is either:
- a `string` — literal text to show, or
- a `number` — a horizontal adjustment in thousandths of a unit of text
  space (negative = move right, positive = move left).

## Parameters

### items

readonly (`string` \| `number`)[]

Array of strings and numeric adjustments.

## Returns

`string`
