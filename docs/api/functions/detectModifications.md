[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectModifications

# Function: detectModifications()

```ts
function detectModifications(pdf): Promise<ModificationReport>;
```

Defined in: [src/signature/modificationDetector.ts:152](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L152)

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

`Promise`\&lt;[`ModificationReport`](../interfaces/ModificationReport.md)\&gt;

A detailed modification report.
