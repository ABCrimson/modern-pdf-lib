[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildType1Halftone

# Function: buildType1Halftone()

> **buildType1Halftone**(`p`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/core/halftone.ts:100

Build a Type 1 halftone dictionary.

Emits `/Type /Halftone /HalftoneType 1` with numeric `/Frequency` and
`/Angle`, a `/SpotFunction` name, and an optional `/AccurateScreens`
boolean.

## Parameters

### p

[`Type1Halftone`](../interfaces/Type1Halftone.md)

## Returns

[`PdfDict`](../classes/PdfDict.md)
