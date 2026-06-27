[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / batchMerge

# Function: batchMerge()

```ts
function batchMerge(files, options?): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/batch/batchProcessor.ts:354](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/batch/batchProcessor.ts#L354)

Merge multiple PDFs in parallel chunks, then merge the chunks.

For large collections this is significantly faster than sequential
merging because parsing and page-copying can overlap.

## Parameters

### files

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]

Array of raw PDF bytes to merge (in order).

### options?

[`BatchOptions`](../interfaces/BatchOptions.md)

Concurrency and progress options.

## Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The merged PDF as `Uint8Array`.
