[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyPreset

# Function: applyPreset()

```ts
function applyPreset(preset, options): DrawTableOptions;
```

Defined in: [src/layout/presets.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/presets.ts#L130)

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
