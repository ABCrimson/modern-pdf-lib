[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyTablePreset

# Function: applyTablePreset()

```ts
function applyTablePreset(preset, options?): Partial<DrawTableOptions>;
```

Defined in: [src/layout/presets.ts:163](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/presets.ts#L163)

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

`Partial`\&lt;[`DrawTableOptions`](../interfaces/DrawTableOptions.md)\&gt;
