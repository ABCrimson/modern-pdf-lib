[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / shrinkFontSize

# Function: shrinkFontSize()

> **shrinkFontSize**(`text`, `availableWidth`, `fontSize`, `options?`): `number`

Defined in: [src/layout/overflow.ts:238](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/layout/overflow.ts#L238)

Calculate the font size needed to fit text within `availableWidth`.

If the text already fits at the given `fontSize`, that size is returned.
The result is clamped to `minFontSize` so text never becomes illegibly small.

## Parameters

### text

`string`

The text to fit.

### availableWidth

`number`

Maximum width in points.

### fontSize

`number`

Starting font size in points.

### options?

Optional configuration.

#### avgCharWidth?

`number`

Average character width fraction. Default: `0.5`.

#### minFontSize?

`number`

Minimum font size floor. Default: `6`.

## Returns

`number`

The (possibly reduced) font size.
