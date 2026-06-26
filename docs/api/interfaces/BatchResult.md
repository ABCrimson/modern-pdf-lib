[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / BatchResult

# Interface: BatchResult

Defined in: [src/batch/batchProcessor.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/batch/batchProcessor.ts#L59)

Result of a batch operation.

## Properties

### errors

```ts
errors: Map<number, Error>;
```

Defined in: [src/batch/batchProcessor.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/batch/batchProcessor.ts#L65)

Indices of files that failed, mapped to their error.

***

### outputs

```ts
outputs: Uint8Array<ArrayBufferLike>[];
```

Defined in: [src/batch/batchProcessor.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/batch/batchProcessor.ts#L61)

Output PDF bytes for each input file (same order).

***

### successCount

```ts
successCount: number;
```

Defined in: [src/batch/batchProcessor.ts:63](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/batch/batchProcessor.ts#L63)

Number of files that were processed successfully.
