[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectModifications

# Function: detectModifications()

> **detectModifications**(`pdf`): `Promise`\<[`ModificationReport`](../interfaces/ModificationReport.md)\>

Defined in: [src/signature/modificationDetector.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L170)

Detect modifications in a certified PDF document.

Compares content at each signature's byte range against the current
PDF state. If an MDP (DocMDP) certification level is set, checks
whether the modifications comply with the permitted level.

Modification levels:
- MDP 1 (NoChanges): Any change is a violation
- MDP 2 (FormFillAndSign): Only form fills and new signatures allowed
- MDP 3 (FormFillSignAnnotate): Form fills, signatures, and annotations allowed

## Parameters

### pdf

`Uint8Array`

The PDF bytes to analyze.

## Returns

`Promise`\<[`ModificationReport`](../interfaces/ModificationReport.md)\>

A detailed modification report.
