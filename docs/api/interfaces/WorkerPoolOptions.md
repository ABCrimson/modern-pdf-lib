[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WorkerPoolOptions

# Interface: WorkerPoolOptions

Defined in: [src/runtime/workerPool.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/workerPool.ts#L34)

Options for [createWorkerPool](../functions/createWorkerPool.md).

## Properties

### concurrency?

```ts
readonly optional concurrency?: number;
```

Defined in: [src/runtime/workerPool.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/runtime/workerPool.ts#L40)

Maximum number of tasks allowed to run simultaneously. Defaults to
`globalThis.navigator?.hardwareConcurrency ?? 4`. Must be a positive
integer.
