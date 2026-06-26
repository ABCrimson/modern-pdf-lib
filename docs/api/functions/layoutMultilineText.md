[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutMultilineText

# Function: layoutMultilineText()

```ts
function layoutMultilineText(text, options): LayoutMultilineResult;
```

Defined in: [src/core/layout.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/layout.ts#L42)

Break text into lines that fit within `maxWidth`, measuring each line's
width.  Explicit newlines (`\n`) are always honoured.

The returned `height` is the total vertical extent: one line's ascent
plus `(n-1) * lineHeight`.

## Parameters

### text

`string`

### options

[`LayoutMultilineOptions`](../interfaces/LayoutMultilineOptions.md)

## Returns

[`LayoutMultilineResult`](../interfaces/LayoutMultilineResult.md)
