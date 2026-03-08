[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isValidModuleName

# Function: isValidModuleName()

> **isValidModuleName**(`name`): name is "libdeflate" \| "png" \| "ttf" \| "shaping" \| "jbig2" \| "jpeg"

Defined in: src/wasm/inlineWasm.ts:131

Check whether a given module name is a valid WASM module name.

## Parameters

### name

`string`

The name to check.

## Returns

name is "libdeflate" \| "png" \| "ttf" \| "shaping" \| "jbig2" \| "jpeg"

`true` if the name is one of the known WASM modules.
