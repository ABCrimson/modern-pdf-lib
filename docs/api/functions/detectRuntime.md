[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectRuntime

# Function: detectRuntime()

> **detectRuntime**(): [`RuntimeKind`](../type-aliases/RuntimeKind.md)

Defined in: [src/wasm/loader.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/loader.ts#L110)

Detect the current JavaScript runtime environment.

## Returns

[`RuntimeKind`](../type-aliases/RuntimeKind.md)

The detected runtime kind.

## Example

```ts
const runtime = detectRuntime();
if (runtime === 'node') { ... }
```
