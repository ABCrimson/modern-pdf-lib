[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchOptions

# Interface: BatchOptions

Defined in: src/batch/batchProcessor.ts:30

Options for batch processing.

## Properties

### concurrency?

> `optional` **concurrency**: `number`

Defined in: src/batch/batchProcessor.ts:35

Maximum number of PDFs processed concurrently.
Defaults to 4 in Node (worker threads), or `files.length` elsewhere.

***

### onProgress?

> `optional` **onProgress**: [`BatchProgressCallback`](../type-aliases/BatchProgressCallback.md)

Defined in: src/batch/batchProcessor.ts:38

Progress callback invoked after each file completes.
