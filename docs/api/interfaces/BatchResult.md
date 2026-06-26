[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchResult

# Interface: BatchResult

Defined in: [src/batch/batchProcessor.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L59)

Result of a batch operation.

## Properties

### errors

> **errors**: `Map`\<`number`, `Error`\>

Defined in: [src/batch/batchProcessor.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L65)

Indices of files that failed, mapped to their error.

***

### outputs

> **outputs**: `Uint8Array`\<`ArrayBufferLike`\>[]

Defined in: [src/batch/batchProcessor.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L61)

Output PDF bytes for each input file (same order).

***

### successCount

> **successCount**: `number`

Defined in: [src/batch/batchProcessor.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L63)

Number of files that were processed successfully.
