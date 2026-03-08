[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ChromaSubsampling

# Type Alias: ChromaSubsampling

> **ChromaSubsampling** = `"4:4:4"` \| `"4:2:2"` \| `"4:2:0"`

Defined in: [src/wasm/jpeg/bridge.ts:61](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/wasm/jpeg/bridge.ts#L61)

Chroma subsampling modes for JPEG encoding.

- `'4:4:4'`: No subsampling — best quality, largest file.
- `'4:2:2'`: Horizontal subsampling — good balance.
- `'4:2:0'`: Both directions — smallest file, default for most encoders.
