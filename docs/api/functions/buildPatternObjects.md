[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPatternObjects

# Function: buildPatternObjects()

> **buildPatternObjects**(`pattern`, `registry`): `object`

Defined in: [src/core/patterns.ts:418](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/patterns.ts#L418)

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
