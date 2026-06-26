[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / configureWasmLoader

# Function: configureWasmLoader()

```ts
function configureWasmLoader(config): void;
```

Defined in: [src/wasm/loader.ts:182](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L182)

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
