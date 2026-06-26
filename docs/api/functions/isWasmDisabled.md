[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isWasmDisabled

# Function: isWasmDisabled()

> **isWasmDisabled**(): `boolean`

Defined in: [src/wasm/loader.ts:589](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/loader.ts#L589)

Check whether WASM loading has been globally disabled.

## Returns

`boolean`

`true` if `configureWasmLoader({ disableWasm: true })` was called.

## Example

```ts
configureWasmLoader({ disableWasm: true });
console.log(isWasmDisabled()); // true
```
