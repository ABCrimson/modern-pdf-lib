[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WorkerPoolOptions

# Interface: WorkerPoolOptions

Defined in: src/runtime/workerPool.ts:34

Options for [createWorkerPool](../functions/createWorkerPool.md).

## Properties

### concurrency?

> `readonly` `optional` **concurrency?**: `number`

Defined in: src/runtime/workerPool.ts:40

Maximum number of tasks allowed to run simultaneously. Defaults to
`globalThis.navigator?.hardwareConcurrency ?? 4`. Must be a positive
integer.
