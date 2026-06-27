[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ChromaSubsampling

# Type Alias: ChromaSubsampling

```ts
type ChromaSubsampling = "4:4:4" | "4:2:2" | "4:2:0";
```

Defined in: [src/wasm/jpeg/bridge.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/wasm/jpeg/bridge.ts#L42)

Chroma subsampling modes for JPEG encoding.

- `'4:4:4'`: No subsampling — best quality, largest file.
- `'4:2:2'`: Horizontal subsampling — good balance.
- `'4:2:0'`: Both directions — smallest file, default for most encoders.
