[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / provideWasmBytes

# Function: provideWasmBytes()

> **provideWasmBytes**(`name`, `bytes`): `void`

Defined in: [src/wasm/loader.ts:553](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/loader.ts#L553)

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
