[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / radialGradient

# Function: radialGradient()

> **radialGradient**(`options`): [`GradientFill`](../interfaces/GradientFill.md)

Defined in: [src/core/patterns.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/patterns.ts#L272)

Create a radial gradient descriptor.

The gradient interpolates between two circles: the start circle at
`(x0, y0)` with radius `r0` and the end circle at `(x1, y1)` with
radius `r1`.

## Parameters

### options

[`RadialGradientOptions`](../interfaces/RadialGradientOptions.md)

Gradient parameters.

## Returns

[`GradientFill`](../interfaces/GradientFill.md)

A [GradientFill](../interfaces/GradientFill.md) descriptor (with `shadingType: 3`).
