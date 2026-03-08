[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectModifications

# Function: detectModifications()

> **detectModifications**(`pdf`): `Promise`\<[`ModificationReport`](../interfaces/ModificationReport.md)\>

Defined in: [src/signature/modificationDetector.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/modificationDetector.ts#L170)

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
