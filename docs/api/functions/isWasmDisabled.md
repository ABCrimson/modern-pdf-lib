[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isWasmDisabled

# Function: isWasmDisabled()

> **isWasmDisabled**(): `boolean`

Defined in: [src/wasm/loader.ts:578](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/wasm/loader.ts#L578)

Check whether WASM loading has been globally disabled.

## Returns

`boolean`

`true` if `configureWasmLoader({ disableWasm: true })` was called.

## Example

```ts
configureWasmLoader({ disableWasm: true });
console.log(isWasmDisabled()); // true
```
