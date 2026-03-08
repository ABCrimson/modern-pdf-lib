[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / linearGradient

# Function: linearGradient()

> **linearGradient**(`options`): [`GradientFill`](../interfaces/GradientFill.md)

Defined in: [src/core/patterns.ts:248](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/patterns.ts#L248)

Create a linear (axial) gradient descriptor.

The gradient runs from `(x1, y1)` to `(x2, y2)` through the given
colour stops.  By default the gradient extends beyond its endpoints.

## Parameters

### options

[`LinearGradientOptions`](../interfaces/LinearGradientOptions.md)

Gradient parameters.

## Returns

[`GradientFill`](../interfaces/GradientFill.md)

A [GradientFill](../interfaces/GradientFill.md) descriptor.
