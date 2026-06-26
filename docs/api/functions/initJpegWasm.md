[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initJpegWasm

# Function: initJpegWasm()

```ts
function initJpegWasm(wasmSource?): Promise<void>;
```

Defined in: [src/wasm/jpeg/bridge.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/jpeg/bridge.ts#L67)

Initialize the JPEG WASM module.

## Parameters

### wasmSource?

  \| `string`
  \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;
  \| `URL`
  \| `Response`
  \| [`JpegWasmModule`](../interfaces/JpegWasmModule.md)

The WASM binary as `Uint8Array`, URL, `Response`,
                    or a pre-built wasm-bindgen module.  When omitted,
                    the function uses the universal WASM loader.

## Returns

`Promise`\&lt;`void`\&gt;
