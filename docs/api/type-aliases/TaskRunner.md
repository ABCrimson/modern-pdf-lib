[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TaskRunner

# Type Alias: TaskRunner\&lt;I, O\&gt;

```ts
type TaskRunner<I, O> = (input) => Promise<O>;
```

Defined in: [src/runtime/workerPool.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/workerPool.ts#L29)

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
