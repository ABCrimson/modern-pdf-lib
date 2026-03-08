[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchResult

# Interface: BatchResult

Defined in: src/batch/batchProcessor.ts:42

Result of a batch operation.

## Properties

### errors

> **errors**: `Map`\<`number`, `Error`\>

Defined in: src/batch/batchProcessor.ts:48

Indices of files that failed, mapped to their error.

***

### outputs

> **outputs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: src/batch/batchProcessor.ts:44

Output PDF bytes for each input file (same order).

***

### successCount

> **successCount**: `number`

Defined in: src/batch/batchProcessor.ts:46

Number of files that were processed successfully.
