[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStream

# Class: PdfStream

Defined in: [src/core/pdfObjects.ts:349](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L349)

A PDF stream object — a dictionary followed by `stream … endstream`.

The `data` field holds the (possibly compressed) payload.  The caller
is responsible for setting `/Length` in the dict before serialization.

## Constructors

### Constructor

> **new PdfStream**(`dict`, `data`): `PdfStream`

Defined in: [src/core/pdfObjects.ts:353](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L353)

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

Defined in: [src/core/pdfObjects.ts:357](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L357)

Raw stream data (already encoded / compressed).

***

### dict

> `readonly` **dict**: [`PdfDict`](PdfDict.md)

Defined in: [src/core/pdfObjects.ts:355](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L355)

Stream metadata dictionary.

## Methods

### serialize()

> **serialize**(`writer`): `void`

Defined in: [src/core/pdfObjects.ts:385](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L385)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### syncLength()

> **syncLength**(): `void`

Defined in: [src/core/pdfObjects.ts:381](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L381)

Update `/Length` to reflect the current data size.

#### Returns

`void`

***

### fromBytes()

> `static` **fromBytes**(`data`, `extraEntries?`): `PdfStream`

Defined in: [src/core/pdfObjects.ts:374](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L374)

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

Defined in: [src/core/pdfObjects.ts:364](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L364)

Create a stream from a plain UTF-8 string (e.g. content-stream
operators).  Sets `/Length` automatically.

#### Parameters

##### content

`string`

##### extraEntries?

[`PdfDict`](PdfDict.md)

#### Returns

`PdfStream`
