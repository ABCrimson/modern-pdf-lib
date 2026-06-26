[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / provideWasmBytes

# Function: provideWasmBytes()

```ts
function provideWasmBytes(name, bytes): void;
```

Defined in: [src/wasm/loader.ts:553](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L553)

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
