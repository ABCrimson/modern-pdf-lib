[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isWasmModuleCached

# Function: isWasmModuleCached()

```ts
function isWasmModuleCached(name): boolean;
```

Defined in: [src/wasm/loader.ts:564](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L564)

Check whether a WASM module is cached (either pre-provided or
previously loaded).

## Parameters

### name

`string`

Module name.

## Returns

`boolean`

`true` if bytes are available without loading.
