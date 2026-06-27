[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initJpegWasm

# Function: initJpegWasm()

```ts
function initJpegWasm(wasmSource?): Promise<void>;
```

Defined in: [src/wasm/jpeg/bridge.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/wasm/jpeg/bridge.ts#L67)

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
