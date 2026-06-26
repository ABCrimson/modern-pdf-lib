[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isValidModuleName

# Function: isValidModuleName()

> **isValidModuleName**(`name`): name is "libdeflate" \| "png" \| "ttf" \| "shaping" \| "jbig2" \| "jpeg"

Defined in: [src/wasm/inlineWasm.ts:138](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/inlineWasm.ts#L138)

Check whether a given module name is a valid WASM module name.

## Parameters

### name

`string`

The name to check.

## Returns

name is "libdeflate" \| "png" \| "ttf" \| "shaping" \| "jbig2" \| "jpeg"

`true` if the name is one of the known WASM modules.
