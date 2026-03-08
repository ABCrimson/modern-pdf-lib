[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / truncateText

# Function: truncateText()

> **truncateText**(`text`, `availableWidth`, `fontSize`, `avgCharWidth?`): `string`

Defined in: [src/layout/overflow.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/layout/overflow.ts#L171)

Truncate text to fit within `availableWidth`.

If the text already fits, it is returned unchanged.

## Parameters

### text

`string`

The text to truncate.

### availableWidth

`number`

Maximum width in points.

### fontSize

`number`

Font size in points.

### avgCharWidth?

`number` = `0.5`

Average character width as a fraction of fontSize.
                       Default: `0.5`.

## Returns

`string`

The (possibly truncated) text.
