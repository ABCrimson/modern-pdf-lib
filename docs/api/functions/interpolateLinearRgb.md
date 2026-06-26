[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / interpolateLinearRgb

# Function: interpolateLinearRgb()

> **interpolateLinearRgb**(`c0`, `c1`, `t`): `object`

Defined in: [src/assets/svg/svgParser.ts:1153](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/assets/svg/svgParser.ts#L1153)

Interpolate between two colours in linear RGB space.

Linear RGB interpolation converts sRGB (0-255) to linear light,
interpolates, then converts back. This produces perceptually
correct gradients.

## Parameters

### c0

Start colour (0-255 sRGB).

#### b

`number`

#### g

`number`

#### r

`number`

### c1

End colour (0-255 sRGB).

#### b

`number`

#### g

`number`

#### r

`number`

### t

`number`

Interpolation factor (0..1).

## Returns

`object`

Interpolated colour (0-255 sRGB).

### b

> **b**: `number`

### g

> **g**: `number`

### r

> **r**: `number`
