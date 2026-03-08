[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutSinglelineText

# Function: layoutSinglelineText()

> **layoutSinglelineText**(`text`, `options`): [`LayoutSinglelineResult`](../interfaces/LayoutSinglelineResult.md)

Defined in: [src/core/layout.ts:209](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/layout.ts#L209)

Layout a single line of text with optional alignment within bounds.

Unlike [layoutMultilineText](layoutMultilineText.md), this does not perform any wrapping.
It simply measures the text, computes alignment offsets, and returns
the positioned line.

## Parameters

### text

`string`

The text to lay out (single line, no newlines).

### options

[`LayoutSinglelineOptions`](../interfaces/LayoutSinglelineOptions.md)

Font, size, bounds, alignment.

## Returns

[`LayoutSinglelineResult`](../interfaces/LayoutSinglelineResult.md)

The measured line and its position offsets.
