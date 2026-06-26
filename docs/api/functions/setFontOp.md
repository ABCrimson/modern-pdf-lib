[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setFontOp

# Function: setFontOp()

```ts
function setFontOp(fontName, size): string;
```

Defined in: [src/core/operators/text.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/operators/text.ts#L71)

Select font and size (`Tf`).

## Parameters

### fontName

`string`

Resource name of the font (e.g. `/F1`).  The leading
                 slash is added automatically if absent.

### size

`number`

Font size in user-space units.

## Returns

`string`
