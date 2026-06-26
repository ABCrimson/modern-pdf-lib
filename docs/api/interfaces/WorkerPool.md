[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WorkerPool

# Interface: WorkerPool\<I, O\>

Defined in: src/runtime/workerPool.ts:46

A bounded-concurrency task pool.

## Type Parameters

### I

`I`

### O

`O`

## Properties

### activeCount

> `readonly` **activeCount**: `number`

Defined in: src/runtime/workerPool.ts:60

Number of tasks currently executing (excludes queued tasks).

## Methods

### run()

> **run**(`input`): `Promise`\<`O`\>

Defined in: src/runtime/workerPool.ts:52

Schedule a single input. Resolves with the runner's output, or
rejects with the runner's error. Honours the pool's concurrency
limit, queueing if all slots are busy.

#### Parameters

##### input

`I`

#### Returns

`Promise`\<`O`\>

***

### runAll()

> **runAll**(`inputs`): `Promise`\<`O`[]\>

Defined in: src/runtime/workerPool.ts:58

Schedule every input, returning the outputs in the **same order** as
the inputs. Rejects if any task rejects, but every task is still
scheduled and the pool stays usable afterwards.

#### Parameters

##### inputs

readonly `I`[]

#### Returns

`Promise`\<`O`[]\>
