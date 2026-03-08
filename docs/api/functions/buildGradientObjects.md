[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildGradientObjects

# Function: buildGradientObjects()

> **buildGradientObjects**(`gradient`, `registry`): `object`

Defined in: [src/core/patterns.ts:372](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/patterns.ts#L372)

Materialise a [GradientFill](../interfaces/GradientFill.md) descriptor into actual PDF objects
in the given registry.

## Parameters

### gradient

[`GradientFill`](../interfaces/GradientFill.md)

The gradient descriptor.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The document's object registry.

## Returns

`object`

An object with the pattern's indirect reference and a unique
         resource name.

### patternName

> **patternName**: `string`

### patternRef

> **patternRef**: [`PdfRef`](../classes/PdfRef.md)
