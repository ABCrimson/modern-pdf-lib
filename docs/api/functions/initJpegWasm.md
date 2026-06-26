[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initJpegWasm

# Function: initJpegWasm()

> **initJpegWasm**(`wasmSource?`): `Promise`\<`void`\>

Defined in: [src/wasm/jpeg/bridge.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/wasm/jpeg/bridge.ts#L67)

Initialize the JPEG WASM module.

## Parameters

### wasmSource?

`string` \| `Uint8Array`\<`ArrayBufferLike`\> \| `URL` \| `Response` \| [`JpegWasmModule`](../interfaces/JpegWasmModule.md)

The WASM binary as `Uint8Array`, URL, `Response`,
                    or a pre-built wasm-bindgen module.  When omitted,
                    the function uses the universal WASM loader.

## Returns

`Promise`\<`void`\>
