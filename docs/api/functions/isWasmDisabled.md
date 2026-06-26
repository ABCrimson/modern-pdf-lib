[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isWasmDisabled

# Function: isWasmDisabled()

```ts
function isWasmDisabled(): boolean;
```

Defined in: [src/wasm/loader.ts:589](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L589)

Check whether WASM loading has been globally disabled.

## Returns

`boolean`

`true` if `configureWasmLoader({ disableWasm: true })` was called.

## Example

```ts
configureWasmLoader({ disableWasm: true });
console.log(isWasmDisabled()); // true
```
