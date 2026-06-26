[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchOptions

# Interface: BatchOptions

Defined in: [src/batch/batchProcessor.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L33)

Options for batch processing.

## Properties

### concurrency?

> `optional` **concurrency?**: `number`

Defined in: [src/batch/batchProcessor.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L38)

Maximum number of PDFs processed concurrently.
Defaults to 4 in Node (worker threads), or `files.length` elsewhere.

***

### errorStrategy?

> `optional` **errorStrategy?**: [`BatchErrorStrategy`](../type-aliases/BatchErrorStrategy.md)

Defined in: [src/batch/batchProcessor.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L52)

Error handling strategy:
- `'fail-fast'` — stop on first error and reject immediately
- `'continue'` — skip failed items and continue (default)
- `'collect'` — collect all errors and throw an `AggregateError` at the end

***

### maxMemoryMB?

> `optional` **maxMemoryMB?**: `number`

Defined in: [src/batch/batchProcessor.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L44)

Maximum memory usage in MB before throttling concurrency.

***

### onProgress?

> `optional` **onProgress?**: [`BatchProgressCallback`](../type-aliases/BatchProgressCallback.md)

Defined in: [src/batch/batchProcessor.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L41)

Progress callback invoked after each file completes.

***

### timeout?

> `optional` **timeout?**: `number`

Defined in: [src/batch/batchProcessor.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L55)

Per-item timeout in milliseconds. Items exceeding this are treated as errors.
