[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / configureWasmLoader

# Function: configureWasmLoader()

> **configureWasmLoader**(`config`): `void`

Defined in: [src/wasm/loader.ts:181](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/wasm/loader.ts#L181)

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
