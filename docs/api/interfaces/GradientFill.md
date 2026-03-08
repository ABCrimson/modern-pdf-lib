[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / GradientFill

# Interface: GradientFill

Defined in: [src/core/patterns.ts:134](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/patterns.ts#L134)

Descriptor for a gradient fill (linear or radial).
This is a lightweight value object — actual PDF objects are created
when [buildGradientObjects](../functions/buildGradientObjects.md) is called.

## Properties

### coords

> `readonly` **coords**: readonly `number`[]

Defined in: [src/core/patterns.ts:137](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/patterns.ts#L137)

***

### extend

> `readonly` **extend**: `boolean`

Defined in: [src/core/patterns.ts:139](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/patterns.ts#L139)

***

### kind

> `readonly` **kind**: `"gradient"`

Defined in: [src/core/patterns.ts:135](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/patterns.ts#L135)

***

### normalizedStops

> `readonly` **normalizedStops**: readonly [`NormalizedStop`](NormalizedStop.md)[]

Defined in: [src/core/patterns.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/patterns.ts#L138)

***

### shadingType

> `readonly` **shadingType**: `2` \| `3`

Defined in: [src/core/patterns.ts:136](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/patterns.ts#L136)
