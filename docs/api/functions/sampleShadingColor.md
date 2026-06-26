[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / sampleShadingColor

# Function: sampleShadingColor()

```ts
function sampleShadingColor(
   options, 
   x, 
   y): number[];
```

Defined in: [src/core/shadingFunction.ts:163](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/shadingFunction.ts#L163)

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
