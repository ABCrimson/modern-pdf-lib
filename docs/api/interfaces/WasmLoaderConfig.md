[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WasmLoaderConfig

# Interface: WasmLoaderConfig

Defined in: [src/wasm/loader.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L29)

Configuration for custom WASM module paths.

## Properties

### basePath?

> `optional` **basePath**: `string`

Defined in: [src/wasm/loader.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L38)

Base path or URL for WASM modules.

- In browsers, this should be a URL path (e.g. `/wasm/`).
- In Node.js, this should be a filesystem path.
- If not set, the loader attempts to resolve relative to the
  package installation.

***

### disableWasm?

> `optional` **disableWasm**: `boolean`

Defined in: [src/wasm/loader.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L72)

Disable all WASM loading.

When set to `true`, all calls to `loadWasmModule()` will throw
an error, forcing the library to use pure-JS fallback
implementations instead.

This is useful for environments with strict Content Security
Policies that do not allow `wasm-unsafe-eval`.

***

### moduleBytes?

> `optional` **moduleBytes**: `Record`\<`string`, `Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/wasm/loader.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L60)

Pre-loaded WASM bytes keyed by module name.

When provided, the loader skips fetching and uses these bytes
directly. This is the recommended approach for:

- Cloudflare Workers (no filesystem)
- Bundled applications (WASM embedded in JS)
- Testing

***

### modulePaths?

> `optional` **modulePaths**: `Record`\<`string`, `string`\>

Defined in: [src/wasm/loader.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/wasm/loader.ts#L48)

Custom per-module paths.

Keys are module names (e.g. `'libdeflate'`, `'png'`), values are
full paths or URLs to the `.wasm` file.

These take precedence over `basePath`.
