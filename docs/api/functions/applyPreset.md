[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyPreset

# Function: applyPreset()

> **applyPreset**(`preset`, `options`): [`DrawTableOptions`](../interfaces/DrawTableOptions.md)

Defined in: [src/layout/presets.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/layout/presets.ts#L130)

Merge a preset with explicit table options.

Values supplied in `options` always override the preset defaults —
the preset acts as a fallback layer beneath the caller's choices.

## Parameters

### preset

[`TablePreset`](../type-aliases/TablePreset.md)

A partial options object returned by one of the
               preset factory functions.

### options

[`DrawTableOptions`](../interfaces/DrawTableOptions.md)

The caller's table options (must include `x`, `y`,
               `width`, and `rows` at minimum).

## Returns

[`DrawTableOptions`](../interfaces/DrawTableOptions.md)

A fully-merged [DrawTableOptions](../interfaces/DrawTableOptions.md) object.
