[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / IncrementalChange

# Interface: IncrementalChange

Defined in: [src/signature/incrementalOptimizer.ts:22](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalOptimizer.ts#L22)

A single object change for an incremental update.

## Properties

### generationNumber

> **generationNumber**: `number`

Defined in: [src/signature/incrementalOptimizer.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalOptimizer.ts#L26)

The generation number.

***

### newContent

> **newContent**: `Uint8Array`

Defined in: [src/signature/incrementalOptimizer.ts:28](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalOptimizer.ts#L28)

The new content for this object (raw bytes).

***

### objectNumber

> **objectNumber**: `number`

Defined in: [src/signature/incrementalOptimizer.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalOptimizer.ts#L24)

The PDF object number.
