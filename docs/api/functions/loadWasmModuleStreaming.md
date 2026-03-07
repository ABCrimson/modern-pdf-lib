[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / loadWasmModuleStreaming

# Function: loadWasmModuleStreaming()

> **loadWasmModuleStreaming**(`name`): `Promise`\<`Module`\>

Defined in: [src/wasm/loader.ts:416](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/loader.ts#L416)

Load and compile a WASM module using streaming compilation when available.

In browsers with `WebAssembly.compileStreaming`, this compiles the module
while the response is still downloading, significantly reducing load time.
Falls back to `WebAssembly.compile` on the raw bytes when streaming is
not available (Node.js, older browsers).

## Parameters

### name

`string`

Module name (e.g., 'libdeflate', 'png').

## Returns

`Promise`\<`Module`\>

A compiled WebAssembly.Module ready for instantiation.

## Example

```ts
const module = await loadWasmModuleStreaming('libdeflate');
const instance = await WebAssembly.instantiate(module, imports);
```
