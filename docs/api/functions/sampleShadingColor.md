[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / sampleShadingColor

# Function: sampleShadingColor()

> **sampleShadingColor**(`options`, `x`, `y`): `number`[]

Defined in: src/core/shadingFunction.ts:163

Sample the shading's colour at domain coordinate `(x, y)`.

Evaluates `options.fn` at the 2-D input vector and returns the resulting
colour components (clamped to the function's range by
[evaluateFunction](evaluateFunction.md)).

## Parameters

### options

[`FunctionShadingOptions`](../interfaces/FunctionShadingOptions.md)

the shading definition.

### x

`number`

the first domain coordinate.

### y

`number`

the second domain coordinate.

## Returns

`number`[]

the evaluated colour components.
