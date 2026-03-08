[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / batchMerge

# Function: batchMerge()

> **batchMerge**(`files`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: src/batch/batchProcessor.ts:164

Merge multiple PDFs in parallel chunks, then merge the chunks.

For large collections this is significantly faster than sequential
merging because parsing and page-copying can overlap.

## Parameters

### files

`Uint8Array`\<`ArrayBufferLike`\>[]

Array of raw PDF bytes to merge (in order).

### options?

[`BatchOptions`](../interfaces/BatchOptions.md)

Concurrency and progress options.

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The merged PDF as `Uint8Array`.
