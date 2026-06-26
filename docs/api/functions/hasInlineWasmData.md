[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / hasInlineWasmData

# Function: hasInlineWasmData()

```ts
function hasInlineWasmData(name): boolean;
```

Defined in: [src/wasm/inlineWasm.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/inlineWasm.ts#L164)

Check whether inline WASM data is available for a given module.

Returns `true` if the generated file contains base64 data for the
requested module. Returns `false` if the generated file does not
exist or does not include the module.

## Parameters

### name

`string`

The WASM module name.

## Returns

`boolean`

`true` if inline bytes can be retrieved for this module.
