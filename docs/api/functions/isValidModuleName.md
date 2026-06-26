[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isValidModuleName

# Function: isValidModuleName()

```ts
function isValidModuleName(name): name is "libdeflate" | "png" | "ttf" | "shaping" | "jbig2" | "jpeg";
```

Defined in: [src/wasm/inlineWasm.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/inlineWasm.ts#L138)

Check whether a given module name is a valid WASM module name.

## Parameters

### name

`string`

The name to check.

## Returns

name is "libdeflate" \| "png" \| "ttf" \| "shaping" \| "jbig2" \| "jpeg"

`true` if the name is one of the known WASM modules.
