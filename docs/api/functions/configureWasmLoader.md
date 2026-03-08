[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / configureWasmLoader

# Function: configureWasmLoader()

> **configureWasmLoader**(`config`): `void`

Defined in: [src/wasm/loader.ts:181](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L181)

Set the global WASM loader configuration.

Call this once at application startup before any WASM modules
are loaded.

## Parameters

### config

[`WasmLoaderConfig`](../interfaces/WasmLoaderConfig.md)

Loader configuration.

## Returns

`void`

## Example

```ts
configureWasmLoader({
  basePath: '/assets/wasm/',
  moduleBytes: { libdeflate: myBundledWasmBytes },
});
```
