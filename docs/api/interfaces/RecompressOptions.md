[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RecompressOptions

# Interface: RecompressOptions

Defined in: [src/assets/image/imageOptimize.ts:62](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/imageOptimize.ts#L62)

Options for image recompression.

## Extended by

- [`ImageOptimizeOptions`](ImageOptimizeOptions.md)

## Properties

### chromaSubsampling?

> `readonly` `optional` **chromaSubsampling**: [`ChromaSubsampling`](../type-aliases/ChromaSubsampling.md)

Defined in: [src/assets/image/imageOptimize.ts:108](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/imageOptimize.ts#L108)

Chroma subsampling mode.  Only used when `format` is `'jpeg'`.

- `'4:4:4'`: No subsampling — best color fidelity, largest file.
- `'4:2:2'`: Horizontal subsampling — good balance.
- `'4:2:0'`: Both horizontal and vertical — smallest file.

Requires the JPEG WASM module to be initialized.

Default: `'4:2:0'`.

***

### compressionLevel?

> `readonly` `optional` **compressionLevel**: `1` \| `6` \| `3` \| `2` \| `4` \| `5` \| `7` \| `8` \| `9`

Defined in: [src/assets/image/imageOptimize.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/imageOptimize.ts#L84)

Deflate compression level (1–9).  Only used when `format` is `'deflate'`.
Higher values produce smaller files but take longer.

Default: `6`.

***

### format?

> `readonly` `optional` **format**: `"jpeg"` \| `"deflate"`

Defined in: [src/assets/image/imageOptimize.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/imageOptimize.ts#L70)

Output format.
- `'jpeg'`: JPEG compression (lossy, good for photographs)
- `'deflate'`: Deflate/zlib compression (lossless, used in PDF FlateDecode)

Default: `'deflate'`.

***

### progressive?

> `readonly` `optional` **progressive**: `boolean`

Defined in: [src/assets/image/imageOptimize.ts:96](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/imageOptimize.ts#L96)

Encode as progressive JPEG.  Only used when `format` is `'jpeg'`.

Progressive JPEGs render in multiple passes (low-res → full-res)
which improves perceived loading speed on slow connections.
They are also often slightly smaller than baseline JPEGs.

Requires the JPEG WASM module to be initialized.

Default: `false`.

***

### quality?

> `readonly` `optional` **quality**: `number`

Defined in: [src/assets/image/imageOptimize.ts:77](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/imageOptimize.ts#L77)

JPEG quality (1–100).  Only used when `format` is `'jpeg'`.
Higher values produce larger files with better quality.

Default: `85`.
