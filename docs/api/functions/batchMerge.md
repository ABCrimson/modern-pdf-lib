[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / batchMerge

# Function: batchMerge()

> **batchMerge**(`files`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/batch/batchProcessor.ts:354](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L354)

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
