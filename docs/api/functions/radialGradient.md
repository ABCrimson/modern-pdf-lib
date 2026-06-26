[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / radialGradient

# Function: radialGradient()

```ts
function radialGradient(options): GradientFill;
```

Defined in: [src/core/patterns.ts:272](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/patterns.ts#L272)

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
