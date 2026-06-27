[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WorkerPoolOptions

# Interface: WorkerPoolOptions

Defined in: [src/runtime/workerPool.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L34)

Options for [createWorkerPool](../functions/createWorkerPool.md).

## Properties

### concurrency?

```ts
readonly optional concurrency?: number;
```

Defined in: [src/runtime/workerPool.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L40)

Maximum number of tasks allowed to run simultaneously. Defaults to
`globalThis.navigator?.hardwareConcurrency ?? 4`. Must be a positive
integer.
