[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createWorkerPool

# Function: createWorkerPool()

```ts
function createWorkerPool<I, O>(runner, options?): WorkerPool<I, O>;
```

Defined in: [src/runtime/workerPool.ts:94](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L94)

Create a [WorkerPool](../interfaces/WorkerPool.md) backed by the given [TaskRunner](../type-aliases/TaskRunner.md).

## Type Parameters

### I

`I`

### O

`O`

## Parameters

### runner

[`TaskRunner`](../type-aliases/TaskRunner.md)\&lt;`I`, `O`\&gt;

The async function invoked once per scheduled input.

### options?

[`WorkerPoolOptions`](../interfaces/WorkerPoolOptions.md)

Optional [WorkerPoolOptions](../interfaces/WorkerPoolOptions.md).

## Returns

[`WorkerPool`](../interfaces/WorkerPool.md)\&lt;`I`, `O`\&gt;

A [WorkerPool](../interfaces/WorkerPool.md).

## Throws

If `options.concurrency` is provided but is not a positive
        integer.
