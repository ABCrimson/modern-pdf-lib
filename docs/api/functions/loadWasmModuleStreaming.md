[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / loadWasmModuleStreaming

# Function: loadWasmModuleStreaming()

```ts
function loadWasmModuleStreaming(name): Promise<Module>;
```

Defined in: [src/wasm/loader.ts:439](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L439)

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

`Promise`\&lt;`Module`\&gt;

A compiled WebAssembly.Module ready for instantiation.

## Example

```ts
const module = await loadWasmModuleStreaming('libdeflate');
const instance = await WebAssembly.instantiate(module, imports);
```
