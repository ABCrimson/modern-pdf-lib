[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectRuntime

# Function: detectRuntime()

> **detectRuntime**(): [`RuntimeKind`](../type-aliases/RuntimeKind.md)

Defined in: [src/wasm/loader.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/wasm/loader.ts#L110)

Detect the current JavaScript runtime environment.

## Returns

[`RuntimeKind`](../type-aliases/RuntimeKind.md)

The detected runtime kind.

## Example

```ts
const runtime = detectRuntime();
if (runtime === 'node') { ... }
```
