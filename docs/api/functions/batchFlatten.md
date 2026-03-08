[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / batchFlatten

# Function: batchFlatten()

> **batchFlatten**(`files`, `options?`): `Promise`\<[`BatchResult`](../interfaces/BatchResult.md)\>

Defined in: src/batch/batchProcessor.ts:227

Flatten interactive form fields across many PDFs.

Each PDF is loaded, its form is flattened (field values are burned
into page content), and the result is saved.

## Parameters

### files

`Uint8Array`\<`ArrayBufferLike`\>[]

Array of raw PDF bytes.

### options?

[`BatchOptions`](../interfaces/BatchOptions.md)

Concurrency and progress options.

## Returns

`Promise`\<[`BatchResult`](../interfaces/BatchResult.md)\>

A [BatchResult](../interfaces/BatchResult.md) with flattened PDF outputs.
