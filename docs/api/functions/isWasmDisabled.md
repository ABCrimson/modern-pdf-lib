[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isWasmDisabled

# Function: isWasmDisabled()

> **isWasmDisabled**(): `boolean`

Defined in: [src/wasm/loader.ts:566](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/loader.ts#L566)

Check whether WASM loading has been globally disabled.

## Returns

`boolean`

`true` if `configureWasmLoader({ disableWasm: true })` was called.

## Example

```ts
configureWasmLoader({ disableWasm: true });
console.log(isWasmDisabled()); // true
```
