[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TablePreset

# Type Alias: TablePreset

> **TablePreset** = `Partial`\<`Omit`\<[`DrawTableOptions`](../interfaces/DrawTableOptions.md), `"x"` \| `"y"` \| `"width"` \| `"rows"`\>\>

Defined in: [src/layout/presets.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/layout/presets.ts#L23)

A partial set of table options that can be applied as a style preset.
Excludes positional / data fields (`x`, `y`, `width`, `rows`) that
must always be supplied by the caller.
