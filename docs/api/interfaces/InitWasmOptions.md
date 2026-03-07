[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InitWasmOptions

# Interface: InitWasmOptions

Defined in: [src/index.ts:156](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L156)

Options for WASM module initialization.

## Properties

### deflate?

> `optional` **deflate**: `boolean`

Defined in: [src/index.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L158)

Initialize the deflate/inflate WASM module. Default: `false`.

***

### deflateWasm?

> `optional` **deflateWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:167](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L167)

Pre-loaded WASM bytes for the deflate module.
When provided, the module is instantiated directly from these bytes.

***

### fonts?

> `optional` **fonts**: `boolean`

Defined in: [src/index.ts:162](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L162)

Initialize the font subsetting WASM module. Default: `false`.

***

### fontWasm?

> `optional` **fontWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:175](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L175)

Pre-loaded WASM bytes for the font subsetting module.

***

### jpeg?

> `optional` **jpeg**: `boolean`

Defined in: [src/index.ts:177](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L177)

Initialize the JPEG encoding/decoding WASM module. Default: `false`.

***

### jpegWasm?

> `optional` **jpegWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:181](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L181)

Pre-loaded WASM bytes for the JPEG encoding/decoding module.

***

### png?

> `optional` **png**: `boolean`

Defined in: [src/index.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L160)

Initialize the PNG decoding WASM module. Default: `false`.

***

### pngWasm?

> `optional` **pngWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:171](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/index.ts#L171)

Pre-loaded WASM bytes for the PNG decoding module.
