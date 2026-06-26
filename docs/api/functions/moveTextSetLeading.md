[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / moveTextSetLeading

# Function: moveTextSetLeading()

```ts
function moveTextSetLeading(tx, ty): string;
```

Defined in: [src/core/operators/text.ts:194](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/text.ts#L194)

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
