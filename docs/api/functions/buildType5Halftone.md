[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildType5Halftone

# Function: buildType5Halftone()

> **buildType5Halftone**(`colorants`, `defaultHalftone`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/core/halftone.ts:159

Build a Type 5 halftone dictionary.

A Type 5 halftone maps each named colorant to its own halftone
dictionary and supplies a `/Default` halftone for any colorant not
explicitly listed.  Emits `/Type /Halftone /HalftoneType 5`, one entry
per colorant (keyed by colorant name), and `/Default`.

## Parameters

### colorants

`Readonly`\<`Record`\<`string`, [`PdfDict`](../classes/PdfDict.md)\>\>

Map of colorant name → halftone dictionary (each a
  Type 1/6/10/16 halftone). The reserved key `Default` is ignored here
  in favour of `defaultHalftone`.

### defaultHalftone

[`PdfDict`](../classes/PdfDict.md)

The fallback halftone for unlisted colorants.

## Returns

[`PdfDict`](../classes/PdfDict.md)
