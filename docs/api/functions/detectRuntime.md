[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectRuntime

# Function: detectRuntime()

> **detectRuntime**(): [`RuntimeKind`](../type-aliases/RuntimeKind.md)

Defined in: [src/wasm/loader.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L110)

Detect the current JavaScript runtime environment.

## Returns

[`RuntimeKind`](../type-aliases/RuntimeKind.md)

The detected runtime kind.

## Example

```ts
const runtime = detectRuntime();
if (runtime === 'node') { ... }
```
