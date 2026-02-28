[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPatternObjects

# Function: buildPatternObjects()

> **buildPatternObjects**(`pattern`, `registry`): `object`

Defined in: [src/core/patterns.ts:415](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/patterns.ts#L415)

Materialise a [PatternFill](../interfaces/PatternFill.md) descriptor into actual PDF objects
in the given registry.

## Parameters

### pattern

[`PatternFill`](../interfaces/PatternFill.md)

The tiling pattern descriptor.

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
