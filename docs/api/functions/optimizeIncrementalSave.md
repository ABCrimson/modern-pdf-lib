[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / optimizeIncrementalSave

# Function: optimizeIncrementalSave()

> **optimizeIncrementalSave**(`originalPdf`, `changes`): `Uint8Array`

Defined in: [src/signature/incrementalOptimizer.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/incrementalOptimizer.ts#L180)

Optimize an incremental save by removing unchanged objects and
deduplicating identical updates.

This function:
1. Computes FNV-1a hashes of each change's content
2. Compares against the original PDF objects to skip unchanged ones
3. Deduplicates identical change entries (same content for same object)
4. Builds a minimal incremental update containing only truly changed objects

## Parameters

### originalPdf

`Uint8Array`

The original PDF bytes.

### changes

[`IncrementalChange`](../interfaces/IncrementalChange.md)[]

The list of proposed changes.

## Returns

`Uint8Array`

The optimized PDF bytes with minimal incremental update.

## Example

```ts
import { optimizeIncrementalSave } from 'modern-pdf-lib/signature';

const optimizedPdf = optimizeIncrementalSave(originalPdf, [
  { objectNumber: 5, generationNumber: 0, newContent: newObj5 },
  { objectNumber: 7, generationNumber: 0, newContent: newObj7 },
]);
```
