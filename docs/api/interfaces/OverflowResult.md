[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / OverflowResult

# Interface: OverflowResult

Defined in: [src/layout/overflow.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/layout/overflow.ts#L24)

Result of applying an overflow mode to a text string.

## Properties

### fontSize

> `readonly` **fontSize**: `number`

Defined in: [src/layout/overflow.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/layout/overflow.ts#L28)

The font size to use (may differ from input for 'shrink' mode).

***

### lines

> `readonly` **lines**: readonly `string`[]

Defined in: [src/layout/overflow.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/layout/overflow.ts#L26)

The processed line(s) of text.

***

### wasModified

> `readonly` **wasModified**: `boolean`

Defined in: [src/layout/overflow.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/layout/overflow.ts#L30)

Whether the text was modified (truncated, wrapped, or shrunk).
