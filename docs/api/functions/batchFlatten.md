[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / batchFlatten

# Function: batchFlatten()

> **batchFlatten**(`files`, `options?`): `Promise`\<[`BatchResult`](../interfaces/BatchResult.md)\>

Defined in: [src/batch/batchProcessor.ts:419](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/batch/batchProcessor.ts#L419)

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
