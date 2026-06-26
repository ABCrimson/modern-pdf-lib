[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / configureWasmLoader

# Function: configureWasmLoader()

> **configureWasmLoader**(`config`): `void`

Defined in: [src/wasm/loader.ts:182](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/loader.ts#L182)

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
