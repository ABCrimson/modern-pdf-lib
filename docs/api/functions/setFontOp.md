[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setFontOp

# Function: setFontOp()

```ts
function setFontOp(fontName, size): string;
```

Defined in: [src/core/operators/text.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/text.ts#L71)

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
