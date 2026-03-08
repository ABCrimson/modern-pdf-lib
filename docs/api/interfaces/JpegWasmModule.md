[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / JpegWasmModule

# Interface: JpegWasmModule

Defined in: [src/wasm/jpeg/bridge.ts:20](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/wasm/jpeg/bridge.ts#L20)

Pre-built wasm-bindgen module interface (when passed directly).

## Methods

### decode\_jpeg()

> **decode\_jpeg**(`data`): `Uint8Array`

Defined in: [src/wasm/jpeg/bridge.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/wasm/jpeg/bridge.ts#L30)

#### Parameters

##### data

`Uint8Array`

#### Returns

`Uint8Array`

***

### encode\_jpeg()

> **encode\_jpeg**(`pixels`, `width`, `height`, `channels`, `quality`, `progressive`, `chroma_subsampling`): `Uint8Array`

Defined in: [src/wasm/jpeg/bridge.ts:21](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/wasm/jpeg/bridge.ts#L21)

#### Parameters

##### pixels

`Uint8Array`

##### width

`number`

##### height

`number`

##### channels

`number`

##### quality

`number`

##### progressive

`boolean`

##### chroma\_subsampling

`number`

#### Returns

`Uint8Array`
