[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / processBatch

# Function: processBatch()

> **processBatch**(`files`, `operation`, `options?`): `Promise`\<[`BatchResult`](../interfaces/BatchResult.md)\>

Defined in: src/batch/batchProcessor.ts:109

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

`Uint8Array`\<`ArrayBufferLike`\>[]

Array of raw PDF bytes.

### operation

(`doc`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

An async function that receives a loaded
                  [PdfDocument](../classes/PdfDocument.md) and returns the processed
                  PDF as `Uint8Array`.

### options?

[`BatchOptions`](../interfaces/BatchOptions.md)

Concurrency and progress options.

## Returns

`Promise`\<[`BatchResult`](../interfaces/BatchResult.md)\>

A [BatchResult](../interfaces/BatchResult.md) with outputs, success
                  count, and any per-file errors.
