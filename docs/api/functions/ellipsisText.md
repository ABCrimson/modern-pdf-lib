[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ellipsisText

# Function: ellipsisText()

> **ellipsisText**(`text`, `availableWidth`, `fontSize`, `options?`): `string`

Defined in: [src/layout/overflow.ts:201](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/overflow.ts#L201)

Truncate text and append an ellipsis string to fit within `availableWidth`.

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

### options?

Optional configuration.

#### avgCharWidth?

`number`

Average character width fraction. Default: `0.5`.

#### ellipsisChar?

`string`

The ellipsis suffix. Default: `'...'`.

## Returns

`string`

The (possibly truncated + ellipsis) text.
