[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initJpegWasm

# Function: initJpegWasm()

> **initJpegWasm**(`wasmSource?`): `Promise`\<`void`\>

Defined in: [src/wasm/jpeg/bridge.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/wasm/jpeg/bridge.ts#L86)

Initialize the JPEG WASM module.

## Parameters

### wasmSource?

The WASM binary as `Uint8Array`, URL, `Response`,
                    or a pre-built wasm-bindgen module.  When omitted,
                    the function uses the universal WASM loader.

`string` | `URL` | `Uint8Array`\<`ArrayBufferLike`\> | `JpegWasmModule` | `Response`

## Returns

`Promise`\<`void`\>
