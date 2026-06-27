[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / colorToHex

# Function: colorToHex()

```ts
function colorToHex(color): string;
```

Defined in: [src/core/operators/color.ts:227](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/operators/color.ts#L227)

Convert a base colour (RGB, CMYK, or grayscale) to a hex string.

- RGB → `'#rrggbb'`
- CMYK → converted to RGB first, then `'#rrggbb'`
- Grayscale → `'#gggggg'`
- Spot → uses the alternate colour
- DeviceN → throws (no single representation)

## Parameters

### color

[`Color`](../type-aliases/Color.md)

## Returns

`string`

A 7-character hex string like `'#ff0000'`.
