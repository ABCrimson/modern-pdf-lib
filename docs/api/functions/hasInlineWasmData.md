[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / hasInlineWasmData

# Function: hasInlineWasmData()

> **hasInlineWasmData**(`name`): `boolean`

Defined in: [src/wasm/inlineWasm.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/inlineWasm.ts#L164)

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
