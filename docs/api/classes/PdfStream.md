[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfStream

# Class: PdfStream

Defined in: [src/core/pdfObjects.ts:349](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L349)

A PDF stream object — a dictionary followed by `stream … endstream`.

The `data` field holds the (possibly compressed) payload.  The caller
is responsible for setting `/Length` in the dict before serialization.

## Constructors

### Constructor

```ts
new PdfStream(dict, data): PdfStream;
```

Defined in: [src/core/pdfObjects.ts:353](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L353)

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

```ts
data: Uint8Array;
```

Defined in: [src/core/pdfObjects.ts:357](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L357)

Raw stream data (already encoded / compressed).

***

### dict

```ts
readonly dict: PdfDict;
```

Defined in: [src/core/pdfObjects.ts:355](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L355)

Stream metadata dictionary.

## Methods

### serialize()

```ts
serialize(writer): void;
```

Defined in: [src/core/pdfObjects.ts:385](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L385)

#### Parameters

##### writer

[`ByteWriter`](../interfaces/ByteWriter.md)

#### Returns

`void`

***

### syncLength()

```ts
syncLength(): void;
```

Defined in: [src/core/pdfObjects.ts:381](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L381)

Update `/Length` to reflect the current data size.

#### Returns

`void`

***

### fromBytes()

```ts
static fromBytes(data, extraEntries?): PdfStream;
```

Defined in: [src/core/pdfObjects.ts:374](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L374)

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

```ts
static fromString(content, extraEntries?): PdfStream;
```

Defined in: [src/core/pdfObjects.ts:364](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/pdfObjects.ts#L364)

Create a stream from a plain UTF-8 string (e.g. content-stream
operators).  Sets `/Length` automatically.

#### Parameters

##### content

`string`

##### extraEntries?

[`PdfDict`](PdfDict.md)

#### Returns

`PdfStream`
