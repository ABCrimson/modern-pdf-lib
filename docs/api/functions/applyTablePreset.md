[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyTablePreset

# Function: applyTablePreset()

> **applyTablePreset**(`preset`, `options?`): `Partial`\<[`DrawTableOptions`](../interfaces/DrawTableOptions.md)\>

Defined in: [src/layout/presets.ts:163](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/layout/presets.ts#L163)

Select a preset by name and optionally customise it.

Returns a partial [DrawTableOptions](../interfaces/DrawTableOptions.md) that can be spread into
the full options object.

## Parameters

### preset

[`PresetName`](../type-aliases/PresetName.md)

One of 'minimal', 'striped', 'bordered', 'professional'.

### options?

[`PresetOptions`](../interfaces/PresetOptions.md)

Optional overrides for font size and primary color.

## Returns

`Partial`\<[`DrawTableOptions`](../interfaces/DrawTableOptions.md)\>
