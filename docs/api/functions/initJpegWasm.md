[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initJpegWasm

# Function: initJpegWasm()

> **initJpegWasm**(`wasmSource?`): `Promise`\<`void`\>

Defined in: [src/wasm/jpeg/bridge.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/wasm/jpeg/bridge.ts#L86)

Initialize the JPEG WASM module.

## Parameters

### wasmSource?

The WASM binary as `Uint8Array`, URL, `Response`,
                    or a pre-built wasm-bindgen module.  When omitted,
                    the function uses the universal WASM loader.

`string` | `Uint8Array`\<`ArrayBufferLike`\> | `URL` | `Response` | [`JpegWasmModule`](../interfaces/JpegWasmModule.md)

## Returns

`Promise`\<`void`\>
