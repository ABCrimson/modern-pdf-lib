[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / detectRuntime

# Function: detectRuntime()

```ts
function detectRuntime(): RuntimeKind;
```

Defined in: [src/wasm/loader.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L112)

Detect the current JavaScript runtime environment.

## Returns

[`RuntimeKind`](../type-aliases/RuntimeKind.md)

The detected runtime kind.

## Example

```ts
const runtime = detectRuntime();
if (runtime === 'node') { ... }
```
