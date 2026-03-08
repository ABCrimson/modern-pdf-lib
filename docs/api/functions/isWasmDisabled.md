[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isWasmDisabled

# Function: isWasmDisabled()

> **isWasmDisabled**(): `boolean`

Defined in: [src/wasm/loader.ts:566](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L566)

Check whether WASM loading has been globally disabled.

## Returns

`boolean`

`true` if `configureWasmLoader({ disableWasm: true })` was called.

## Example

```ts
configureWasmLoader({ disableWasm: true });
console.log(isWasmDisabled()); // true
```
