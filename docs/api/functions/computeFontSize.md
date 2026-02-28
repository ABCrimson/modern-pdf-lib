[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeFontSize

# Function: computeFontSize()

> **computeFontSize**(`text`, `options`): `number`

Defined in: [src/core/layout.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/layout.ts#L130)

Compute the largest font size (in points) at which `text` fits within
the given width (and optionally height) constraints.

Uses binary search between `minSize` (default 4) and `maxSize`
(default 500), converging to within 0.1 pt.

## Parameters

### text

`string`

### options

[`ComputeFontSizeOptions`](../interfaces/ComputeFontSizeOptions.md)

## Returns

`number`
