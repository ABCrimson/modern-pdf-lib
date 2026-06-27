[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchResult

# Interface: BatchResult

Defined in: [src/batch/batchProcessor.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/batch/batchProcessor.ts#L59)

Result of a batch operation.

## Properties

### errors

```ts
errors: Map<number, Error>;
```

Defined in: [src/batch/batchProcessor.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/batch/batchProcessor.ts#L65)

Indices of files that failed, mapped to their error.

***

### outputs

```ts
outputs: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/batch/batchProcessor.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/batch/batchProcessor.ts#L61)

Output PDF bytes for each input file (same order).

***

### successCount

```ts
successCount: number;
```

Defined in: [src/batch/batchProcessor.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/batch/batchProcessor.ts#L63)

Number of files that were processed successfully.
