[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WorkerPool

# Interface: WorkerPool\&lt;I, O\&gt;

Defined in: [src/runtime/workerPool.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L46)

A bounded-concurrency task pool.

## Type Parameters

### I

`I`

### O

`O`

## Properties

### activeCount

```ts
readonly activeCount: number;
```

Defined in: [src/runtime/workerPool.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L60)

Number of tasks currently executing (excludes queued tasks).

## Methods

### run()

```ts
run(input): Promise<O>;
```

Defined in: [src/runtime/workerPool.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L52)

Schedule a single input. Resolves with the runner's output, or
rejects with the runner's error. Honours the pool's concurrency
limit, queueing if all slots are busy.

#### Parameters

##### input

`I`

#### Returns

`Promise`\&lt;`O`\&gt;

***

### runAll()

```ts
runAll(inputs): Promise<O[]>;
```

Defined in: [src/runtime/workerPool.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/runtime/workerPool.ts#L58)

Schedule every input, returning the outputs in the **same order** as
the inputs. Rejects if any task rejects, but every task is still
scheduled and the pool stays usable afterwards.

#### Parameters

##### inputs

readonly `I`[]

#### Returns

`Promise`\&lt;`O`[]\&gt;
