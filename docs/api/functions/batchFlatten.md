[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / batchFlatten

# Function: batchFlatten()

```ts
function batchFlatten(files, options?): Promise<BatchResult>;
```

Defined in: [src/batch/batchProcessor.ts:419](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/batch/batchProcessor.ts#L419)

Flatten interactive form fields across many PDFs.

Each PDF is loaded, its form is flattened (field values are burned
into page content), and the result is saved.

## Parameters

### files

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]

Array of raw PDF bytes.

### options?

[`BatchOptions`](../interfaces/BatchOptions.md)

Concurrency and progress options.

## Returns

`Promise`\&lt;[`BatchResult`](../interfaces/BatchResult.md)\&gt;

A [BatchResult](../interfaces/BatchResult.md) with flattened PDF outputs.
