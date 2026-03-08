[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / hasInlineWasmData

# Function: hasInlineWasmData()

> **hasInlineWasmData**(`name`): `boolean`

Defined in: src/wasm/inlineWasm.ts:154

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
