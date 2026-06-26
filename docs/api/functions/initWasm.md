[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / initWasm

# Function: initWasm()

> **initWasm**(`options?`): `Promise`\<`void`\>

Defined in: [src/index.ts:202](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/index.ts#L202)

Initialize the optional WASM acceleration modules.

Call this once before `save()` if you want WASM-accelerated
compression, PNG decoding, or font subsetting.  It is safe to call
multiple times -- subsequent calls are no-ops.

If not called, the library falls back to pure-JS implementations
(fflate for compression, JS for PNG decoding).

## Parameters

### options?

`string` \| `URL` \| [`InitWasmOptions`](../interfaces/InitWasmOptions.md)

Configuration for which WASM modules to load,
                and optionally pre-loaded WASM binary bytes.
                When a string or URL is passed, it is treated as
                a legacy `wasmUrl` parameter (ignored for backward
                compatibility).

## Returns

`Promise`\<`void`\>

A promise that resolves when all requested modules
                are ready.
