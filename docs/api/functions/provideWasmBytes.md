[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / provideWasmBytes

# Function: provideWasmBytes()

> **provideWasmBytes**(`name`, `bytes`): `void`

Defined in: [src/wasm/loader.ts:530](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/wasm/loader.ts#L530)

Provide WASM bytes directly for a module.

This bypasses all runtime detection and path resolution. Use this
for bundled scenarios or when WASM bytes are loaded through a
custom mechanism.

## Parameters

### name

`string`

Module name.

### bytes

`Uint8Array`

Raw WASM bytes.

## Returns

`void`

## Example

```ts
// In a Cloudflare Worker
import wasmModule from './deflate.wasm';
provideWasmBytes('libdeflate', new Uint8Array(wasmModule));
```
