[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / colorToHex

# Function: colorToHex()

> **colorToHex**(`color`): `string`

Defined in: [src/core/operators/color.ts:227](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/operators/color.ts#L227)

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
