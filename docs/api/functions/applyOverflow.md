[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyOverflow

# Function: applyOverflow()

> **applyOverflow**(`text`, `mode`, `availableWidth`, `fontSize`, `options?`): [`OverflowResult`](../interfaces/OverflowResult.md)

Defined in: [src/layout/overflow.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/overflow.ts#L275)

Apply overflow handling to text, returning processed line(s) and
an adjusted fontSize.

This is the primary entry point — it dispatches to the appropriate
strategy function based on the requested `mode`.

## Parameters

### text

`string`

The text to process.

### mode

[`OverflowMode`](../type-aliases/OverflowMode.md)

The overflow mode to apply.

### availableWidth

`number`

Maximum width in points.

### fontSize

`number`

Font size in points.

### options?

Optional configuration.

#### avgCharWidth?

`number`

#### ellipsisChar?

`string`

#### minFontSize?

`number`

## Returns

[`OverflowResult`](../interfaces/OverflowResult.md)

An [OverflowResult](../interfaces/OverflowResult.md) with lines, fontSize,
                       and a flag indicating whether the text was modified.
