[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / preloadInlineWasm

# Function: preloadInlineWasm()

```ts
function preloadInlineWasm(...names): string[];
```

Defined in: [src/wasm/inlineWasm.ts:225](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/wasm/inlineWasm.ts#L225)

Proactively decode and cache WASM bytes for the specified modules.

Call this during application initialization to avoid decoding latency
on the first actual use. If no names are provided, all available
modules are preloaded.

## Parameters

### names

...`string`[]

Optional list of module names to preload. Defaults to
              all modules present in the generated data.

## Returns

`string`[]

The names of modules that were successfully preloaded.

## Example

```ts
// Preload specific modules
preloadInlineWasm('libdeflate', 'png');

// Preload everything available
preloadInlineWasm();
```
