[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / wrapText

# Function: wrapText()

> **wrapText**(`text`, `availableWidth`, `fontSize`, `avgCharWidth?`): `string`[]

Defined in: [src/layout/overflow.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/overflow.ts#L76)

Split text into lines that fit within `availableWidth`.

Word boundaries (spaces) are preferred. If a single word is wider
than `availableWidth`, it is broken mid-word to guarantee every
returned line fits.

## Parameters

### text

`string`

The text to wrap.

### availableWidth

`number`

Maximum line width in points.

### fontSize

`number`

Font size in points.

### avgCharWidth?

`number` = `0.5`

Average character width as a fraction of fontSize.
                       Default: `0.5`.

## Returns

`string`[]

Array of lines.
