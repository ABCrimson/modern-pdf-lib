[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStream

# Class: PdfStream

Defined in: [src/core/pdfObjects.ts:339](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L339)

A PDF stream object — a dictionary followed by `stream … endstream`.

The `data` field holds the (possibly compressed) payload.  The caller
is responsible for setting `/Length` in the dict before serialization.

## Constructors

### Constructor

> **new PdfStream**(`dict`, `data`): `PdfStream`

Defined in: [src/core/pdfObjects.ts:343](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L343)

#### Parameters

##### dict

[`PdfDict`](PdfDict.md)

Stream metadata dictionary.

##### data

`Uint8Array`

Raw stream data (already encoded / compressed).

#### Returns

`PdfStream`

## Properties

### data

> **data**: `Uint8Array`

Defined in: [src/core/pdfObjects.ts:347](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L347)

Raw stream data (already encoded / compressed).

***

### dict

> `readonly` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/core/pdfObjects.ts:345](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L345)

Stream metadata dictionary.

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:375](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L375)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### syncLength()

> **syncLength**(): `void`

Defined in: [src/core/pdfObjects.ts:371](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L371)

Update `/Length` to reflect the current data size.

#### Returns

`void`

***

### fromBytes()

> `static` **fromBytes**(`data`, `extraEntries?`): `PdfStream`

Defined in: [src/core/pdfObjects.ts:364](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L364)

Create a stream from raw bytes.  Sets `/Length` automatically.

#### Parameters

##### data

`Uint8Array`

##### extraEntries?

[`PdfDict`](PdfDict.md)

#### Returns

`PdfStream`

***

### fromString()

> `static` **fromString**(`content`, `extraEntries?`): `PdfStream`

Defined in: [src/core/pdfObjects.ts:354](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/pdfObjects.ts#L354)

Create a stream from a plain UTF-8 string (e.g. content-stream
operators).  Sets `/Length` automatically.

#### Parameters

##### content

`string`

##### extraEntries?

[`PdfDict`](PdfDict.md)

#### Returns

`PdfStream`
