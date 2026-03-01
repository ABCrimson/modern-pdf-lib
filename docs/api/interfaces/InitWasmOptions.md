[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / InitWasmOptions

# Interface: InitWasmOptions

Defined in: [src/index.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L155)

Options for WASM module initialization.

## Properties

### deflate?

> `optional` **deflate**: `boolean`

Defined in: [src/index.ts:157](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L157)

Initialize the deflate/inflate WASM module. Default: `false`.

***

### deflateWasm?

> `optional` **deflateWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:166](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L166)

Pre-loaded WASM bytes for the deflate module.
When provided, the module is instantiated directly from these bytes.

***

### fonts?

> `optional` **fonts**: `boolean`

Defined in: [src/index.ts:161](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L161)

Initialize the font subsetting WASM module. Default: `false`.

***

### fontWasm?

> `optional` **fontWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:174](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L174)

Pre-loaded WASM bytes for the font subsetting module.

***

### jpeg?

> `optional` **jpeg**: `boolean`

Defined in: [src/index.ts:176](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L176)

Initialize the JPEG encoding/decoding WASM module. Default: `false`.

***

### jpegWasm?

> `optional` **jpegWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L180)

Pre-loaded WASM bytes for the JPEG encoding/decoding module.

***

### png?

> `optional` **png**: `boolean`

Defined in: [src/index.ts:159](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L159)

Initialize the PNG decoding WASM module. Default: `false`.

***

### pngWasm?

> `optional` **pngWasm**: `Uint8Array`\<`ArrayBufferLike`\>

Defined in: [src/index.ts:170](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/index.ts#L170)

Pre-loaded WASM bytes for the PNG decoding module.
