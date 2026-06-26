[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TablePreset

# Type Alias: TablePreset

```ts
type TablePreset = Partial<Omit<DrawTableOptions, "x" | "y" | "width" | "rows">>;
```

Defined in: [src/layout/presets.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/presets.ts#L23)

A partial set of table options that can be applied as a style preset.
Excludes positional / data fields (`x`, `y`, `width`, `rows`) that
must always be supplied by the caller.
