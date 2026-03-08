[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getInlineWasmBytes

# Function: getInlineWasmBytes()

> **getInlineWasmBytes**(`name`): `Uint8Array`

Defined in: src/wasm/inlineWasm.ts:74

Retrieve the decoded WASM bytes for a given module name.

On first call for a module, the base64 string from the generated file
is decoded into a `Uint8Array`. Subsequent calls return the cached
result.

## Parameters

### name

`string`

The WASM module name (e.g., `'libdeflate'`, `'png'`).

## Returns

`Uint8Array`

The decoded WASM binary as a `Uint8Array`.

## Throws

If the module name is unknown or the generated file does
             not contain data for the requested module.

## Example

```ts
const wasmBytes = getInlineWasmBytes('libdeflate');
const module = await WebAssembly.compile(wasmBytes);
```
