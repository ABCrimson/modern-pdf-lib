[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / moveTextSetLeading

# Function: moveTextSetLeading()

> **moveTextSetLeading**(`tx`, `ty`): `string`

Defined in: [src/core/operators/text.ts:194](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/operators/text.ts#L194)

Move to the start of the next line, offset by `(tx, ty)`, and set the
leading to `-ty` (`TD`).

Equivalent to: `-ty TL` followed by `tx ty Td`.

## Parameters

### tx

`number`

### ty

`number`

## Returns

`string`
