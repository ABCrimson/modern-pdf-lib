[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / moveTextSetLeading

# Function: moveTextSetLeading()

> **moveTextSetLeading**(`tx`, `ty`): `string`

Defined in: [src/core/operators/text.ts:194](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/operators/text.ts#L194)

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
