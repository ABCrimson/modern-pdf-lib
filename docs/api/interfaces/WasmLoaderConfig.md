[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WasmLoaderConfig

# Interface: WasmLoaderConfig

Defined in: [src/wasm/loader.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L31)

Configuration for custom WASM module paths.

## Properties

### basePath?

```ts
optional basePath?: string;
```

Defined in: [src/wasm/loader.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L40)

Base path or URL for WASM modules.

- In browsers, this should be a URL path (e.g. `/wasm/`).
- In Node.js, this should be a filesystem path.
- If not set, the loader attempts to resolve relative to the
  package installation.

***

### disableWasm?

```ts
optional disableWasm?: boolean;
```

Defined in: [src/wasm/loader.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L74)

Disable all WASM loading.

When set to `true`, all calls to `loadWasmModule()` will throw
an error, forcing the library to use pure-JS fallback
implementations instead.

This is useful for environments with strict Content Security
Policies that do not allow `wasm-unsafe-eval`.

***

### moduleBytes?

```ts
optional moduleBytes?: Record<string, Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/wasm/loader.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L62)

Pre-loaded WASM bytes keyed by module name.

When provided, the loader skips fetching and uses these bytes
directly. This is the recommended approach for:

- Cloudflare Workers (no filesystem)
- Bundled applications (WASM embedded in JS)
- Testing

***

### modulePaths?

```ts
optional modulePaths?: Record<string, string>;
```

Defined in: [src/wasm/loader.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/wasm/loader.ts#L50)

Custom per-module paths.

Keys are module names (e.g. `'libdeflate'`, `'png'`), values are
full paths or URLs to the `.wasm` file.

These take precedence over `basePath`.
