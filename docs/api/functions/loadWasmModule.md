[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / loadWasmModule

# Function: loadWasmModule()

```ts
function loadWasmModule(name): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/wasm/loader.ts:350](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/wasm/loader.ts#L350)

Load a WASM module by name.

Returns the raw `.wasm` bytes, suitable for passing to
`WebAssembly.compile()` or `WebAssembly.instantiate()`.

Results are cached -- subsequent calls for the same module name
return the cached bytes without re-fetching.

## Parameters

### name

`string`

Module name. One of: `'libdeflate'`, `'png'`, `'ttf'`, `'shaping'`, `'jbig2'`.

## Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

The raw WASM bytes.

## Throws

If the module cannot be loaded in the current runtime.

## Example

```ts
// Auto-detect runtime and load
const wasmBytes = await loadWasmModule('libdeflate');

// Pre-configure for Workers
configureWasmLoader({ moduleBytes: { libdeflate: bundledBytes } });
const bytes = await loadWasmModule('libdeflate');
```
