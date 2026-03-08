[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectRuntime

# Function: detectRuntime()

> **detectRuntime**(): [`RuntimeKind`](../type-aliases/RuntimeKind.md)

Defined in: [src/wasm/loader.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/wasm/loader.ts#L110)

Detect the current JavaScript runtime environment.

## Returns

[`RuntimeKind`](../type-aliases/RuntimeKind.md)

The detected runtime kind.

## Example

```ts
const runtime = detectRuntime();
if (runtime === 'node') { ... }
```
