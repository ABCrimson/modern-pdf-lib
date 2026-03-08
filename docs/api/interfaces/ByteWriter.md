[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ByteWriter

# Interface: ByteWriter

Defined in: [src/core/pdfObjects.ts:21](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfObjects.ts#L21)

Minimal interface consumed by every `serialize()` method.
Implementations may write to a growing `Uint8Array`, a `WritableStream`,
etc.

## Methods

### write()

> **write**(`data`): `void`

Defined in: [src/core/pdfObjects.ts:23](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfObjects.ts#L23)

Append raw bytes.

#### Parameters

##### data

`Uint8Array`

#### Returns

`void`

***

### writeString()

> **writeString**(`str`): `void`

Defined in: [src/core/pdfObjects.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/pdfObjects.ts#L25)

Append an ASCII / Latin-1 string — callers guarantee all chars < 0x100.

#### Parameters

##### str

`string`

#### Returns

`void`
