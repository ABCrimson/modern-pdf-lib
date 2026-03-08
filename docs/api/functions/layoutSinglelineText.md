[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / layoutSinglelineText

# Function: layoutSinglelineText()

> **layoutSinglelineText**(`text`, `options`): [`LayoutSinglelineResult`](../interfaces/LayoutSinglelineResult.md)

Defined in: [src/core/layout.ts:209](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/layout.ts#L209)

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
