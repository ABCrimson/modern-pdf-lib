[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / instantiateWasmModuleStreaming

# Function: instantiateWasmModuleStreaming()

> **instantiateWasmModuleStreaming**(`name`, `imports?`): `Promise`\<`Instance`\>

Defined in: [src/wasm/loader.ts:470](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/wasm/loader.ts#L470)

Load, compile, and instantiate a WASM module with streaming when available.

In browsers with `WebAssembly.instantiateStreaming`, this compiles and
instantiates the module while the response is still downloading.
Falls back to `WebAssembly.instantiate` on the raw bytes when streaming
is not available (Node.js, older browsers).

## Parameters

### name

`string`

Module name (e.g., 'libdeflate', 'png').

### imports?

`WebAssembly.Imports` = `{}`

WebAssembly import object.

## Returns

`Promise`\<`Instance`\>

An instantiated WebAssembly module.

## Example

```ts
const instance = await instantiateWasmModuleStreaming('libdeflate', {});
const { compress } = instance.exports;
```
