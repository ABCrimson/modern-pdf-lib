[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / computeFontSize

# Function: computeFontSize()

> **computeFontSize**(`text`, `options`): `number`

Defined in: [src/core/layout.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/layout.ts#L130)

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
