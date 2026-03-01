[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / radialGradient

# Function: radialGradient()

> **radialGradient**(`options`): [`GradientFill`](../interfaces/GradientFill.md)

Defined in: [src/core/patterns.ts:269](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/patterns.ts#L269)

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
