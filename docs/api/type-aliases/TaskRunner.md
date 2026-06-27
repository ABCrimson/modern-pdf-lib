[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TaskRunner

# Type Alias: TaskRunner\&lt;I, O\&gt;

```ts
type TaskRunner<I, O> = (input) => Promise<O>;
```

Defined in: [src/runtime/workerPool.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L29)

The unit of work executed by a [WorkerPool](../interfaces/WorkerPool.md). Maps a single input
to a promise of its output.

## Type Parameters

### I

`I`

### O

`O`

## Parameters

### input

`I`

## Returns

`Promise`\&lt;`O`\&gt;
