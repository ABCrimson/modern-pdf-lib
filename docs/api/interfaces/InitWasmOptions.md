[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InitWasmOptions

# Interface: InitWasmOptions

Defined in: [src/index.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/index.ts#L145)

Options for WASM module initialization.

## Properties

### deflate?

> `optional` **deflate**: `boolean`

Defined in: [src/index.ts:147](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/index.ts#L147)

Initialize the deflate/inflate WASM module. Default: `false`.

***

### deflateWasm?

> `optional` **deflateWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:156](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/index.ts#L156)

Pre-loaded WASM bytes for the deflate module.
When provided, the module is instantiated directly from these bytes.

***

### fonts?

> `optional` **fonts**: `boolean`

Defined in: [src/index.ts:151](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/index.ts#L151)

Initialize the font subsetting WASM module. Default: `false`.

***

### fontWasm?

> `optional` **fontWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:164](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/index.ts#L164)

Pre-loaded WASM bytes for the font subsetting module.

***

### png?

> `optional` **png**: `boolean`

Defined in: [src/index.ts:149](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/index.ts#L149)

Initialize the PNG decoding WASM module. Default: `false`.

***

### pngWasm?

> `optional` **pngWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:160](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/index.ts#L160)

Pre-loaded WASM bytes for the PNG decoding module.
