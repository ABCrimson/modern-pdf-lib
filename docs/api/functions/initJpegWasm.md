[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initJpegWasm

# Function: initJpegWasm()

> **initJpegWasm**(`wasmSource?`): `Promise`\<`void`\>

Defined in: [src/wasm/jpeg/bridge.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/jpeg/bridge.ts#L86)

Initialize the JPEG WASM module.

## Parameters

### wasmSource?

The WASM binary as `Uint8Array`, URL, `Response`,
                    or a pre-built wasm-bindgen module.  When omitted,
                    the function uses the universal WASM loader.

`string` | `Uint8Array`\<`ArrayBufferLike`\> | `URL` | `Response` | [`JpegWasmModule`](../interfaces/JpegWasmModule.md)

## Returns

`Promise`\<`void`\>
