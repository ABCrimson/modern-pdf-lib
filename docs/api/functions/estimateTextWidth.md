[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / estimateTextWidth

# Function: estimateTextWidth()

> **estimateTextWidth**(`text`, `fontSize`, `avgCharWidth?`): `number`

Defined in: [src/layout/overflow.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/layout/overflow.ts#L50)

Estimate the width of text using character count * fontSize * avgCharWidth.

This is a rough approximation suitable for layout purposes when real
font metrics are unavailable. The default `avgCharWidth` of `0.5` is
a reasonable average for proportional Latin fonts like Helvetica.

## Parameters

### text

`string`

The text to measure.

### fontSize

`number`

Font size in points.

### avgCharWidth?

`number` = `0.5`

Average character width as a fraction of fontSize.
                     Default: `0.5`.

## Returns

`number`

Estimated width in points.
