[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / nameHalftone

# Function: nameHalftone()

> **nameHalftone**(`halftone`, `name?`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/core/halftone.ts:218

Build a graphics-state-ready halftone reference dictionary fragment
pairing a halftone with an optional `/HalftoneName`.

Emits the supplied halftone unchanged when `name` is omitted; otherwise
sets `/HalftoneName` (a literal string) on it and returns it. This is a
convenience for naming a halftone for caching by conforming readers.

## Parameters

### halftone

[`PdfDict`](../classes/PdfDict.md)

### name?

`string`

## Returns

[`PdfDict`](../classes/PdfDict.md)
