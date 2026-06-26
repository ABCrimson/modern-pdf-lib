[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TaskRunner

# Type Alias: TaskRunner\<I, O\>

> **TaskRunner**\<`I`, `O`\> = (`input`) => `Promise`\<`O`\>

Defined in: src/runtime/workerPool.ts:29

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

`Promise`\<`O`\>
