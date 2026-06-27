[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / AFDate\_FormatEx

# Function: AFDate\_FormatEx()

```ts
function AFDate_FormatEx(format): (value) => string;
```

Defined in: [src/form/acrobatDateBuiltins.ts:506](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/acrobatDateBuiltins.ts#L506)

Create an Acrobat-compatible date formatting function.

The returned function takes a raw date string (which may be in
various formats) and returns it formatted according to the given
Acrobat format pattern.

## Parameters

### format

`string`

The Acrobat date format string (e.g. `"mm/dd/yyyy"`).

## Returns

A formatting function `(value: string) => string`.

(`value`) =&gt; `string`
