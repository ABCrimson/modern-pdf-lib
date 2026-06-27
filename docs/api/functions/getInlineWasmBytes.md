[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getInlineWasmBytes

# Function: getInlineWasmBytes()

```ts
function getInlineWasmBytes(name): Uint8Array;
```

Defined in: [src/wasm/inlineWasm.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/wasm/inlineWasm.ts#L93)

Retrieve the decoded WASM bytes for a given module name.

On first call for a module, the base64 string from the generated file
is decoded into a `Uint8Array`. Subsequent calls return the cached
result. If the strong cache has been cleared but a `WeakRef` still
holds the bytes, they are recovered without re-decoding.

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
