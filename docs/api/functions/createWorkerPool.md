[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createWorkerPool

# Function: createWorkerPool()

> **createWorkerPool**\<`I`, `O`\>(`runner`, `options?`): [`WorkerPool`](../interfaces/WorkerPool.md)\<`I`, `O`\>

Defined in: src/runtime/workerPool.ts:94

Create a [WorkerPool](../interfaces/WorkerPool.md) backed by the given [TaskRunner](../type-aliases/TaskRunner.md).

## Type Parameters

### I

`I`

### O

`O`

## Parameters

### runner

[`TaskRunner`](../type-aliases/TaskRunner.md)\<`I`, `O`\>

The async function invoked once per scheduled input.

### options?

[`WorkerPoolOptions`](../interfaces/WorkerPoolOptions.md)

Optional [WorkerPoolOptions](../interfaces/WorkerPoolOptions.md).

## Returns

[`WorkerPool`](../interfaces/WorkerPool.md)\<`I`, `O`\>

A [WorkerPool](../interfaces/WorkerPool.md).

## Throws

If `options.concurrency` is provided but is not a positive
        integer.
