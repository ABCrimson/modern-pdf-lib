[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initJpegWasm

# Function: initJpegWasm()

> **initJpegWasm**(`wasmSource?`): `Promise`\<`void`\>

Defined in: [src/wasm/jpeg/bridge.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/wasm/jpeg/bridge.ts#L86)

Initialize the JPEG WASM module.

## Parameters

### wasmSource?

The WASM binary as `Uint8Array`, URL, `Response`,
                    or a pre-built wasm-bindgen module.  When omitted,
                    the function uses the universal WASM loader.

`string` | `Uint8Array`\<`ArrayBufferLike`\> | `URL` | `Response` | [`JpegWasmModule`](../interfaces/JpegWasmModule.md)

## Returns

`Promise`\<`void`\>
