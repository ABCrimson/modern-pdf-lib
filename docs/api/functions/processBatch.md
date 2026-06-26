[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / processBatch

# Function: processBatch()

```ts
function processBatch(
   files, 
   operation, 
options?): Promise<BatchResult>;
```

Defined in: [src/batch/batchProcessor.ts:245](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/batch/batchProcessor.ts#L245)

Process multiple PDFs in parallel (or with bounded concurrency).

Each input `Uint8Array` is loaded as a [PdfDocument](../classes/PdfDocument.md), the
caller-supplied `operation` is applied, and the resulting bytes
are collected.

In Node.js, true parallelism is available via `worker_threads`
(though this implementation uses async concurrency for simplicity
and to avoid serialization overhead). In all runtimes the
concurrency limiter ensures memory pressure stays manageable.

## Parameters

### files

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]

Array of raw PDF bytes.

### operation

(`doc`) =&gt; `Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

An async function that receives a loaded
                  [PdfDocument](../classes/PdfDocument.md) and returns the processed
                  PDF as `Uint8Array`.

### options?

[`BatchOptions`](../interfaces/BatchOptions.md)

Concurrency, progress, memory, error, and timeout options.

## Returns

`Promise`\&lt;[`BatchResult`](../interfaces/BatchResult.md)\&gt;

A [BatchResult](../interfaces/BatchResult.md) with outputs, success
                  count, and any per-file errors.
