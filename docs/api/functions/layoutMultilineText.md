[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutMultilineText

# Function: layoutMultilineText()

> **layoutMultilineText**(`text`, `options`): [`LayoutMultilineResult`](../interfaces/LayoutMultilineResult.md)

Defined in: [src/core/layout.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/layout.ts#L42)

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
