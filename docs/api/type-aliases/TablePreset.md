[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TablePreset

# Type Alias: TablePreset

> **TablePreset** = `Partial`\<`Omit`\<[`DrawTableOptions`](../interfaces/DrawTableOptions.md), `"x"` \| `"y"` \| `"width"` \| `"rows"`\>\>

Defined in: [src/layout/presets.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/layout/presets.ts#L23)

A partial set of table options that can be applied as a style preset.
Excludes positional / data fields (`x`, `y`, `width`, `rows`) that
must always be supplied by the caller.
