[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingPdfParser

# Class: StreamingPdfParser

Defined in: [src/parser/streamingParser.ts:528](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L528)

A streaming PDF parser that processes PDF data incrementally without
loading the entire file into memory.

Useful for multi-GB PDFs where loading everything into memory is
impractical.

## Examples

```ts
// From a ReadableStream (e.g. fetch response)
const response = await fetch('/large.pdf');
const result = await StreamingPdfParser.fromStream(response.body!);
console.log(`Pages: ${result.pageCount}`);
```

```ts
// Chunk-by-chunk with events
const parser = new StreamingPdfParser();
parser.on('page', (event) => {
  if (event.type === 'page') console.log(`Page ${event.index}`);
});
parser.feed(chunk1);
parser.feed(chunk2);
const result = parser.end();
```

## Constructors

### Constructor

> **new StreamingPdfParser**(`options?`): `StreamingPdfParser`

Defined in: [src/parser/streamingParser.ts:548](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L548)

#### Parameters

##### options?

[`StreamingParserOptions`](../interfaces/StreamingParserOptions.md)

#### Returns

`StreamingPdfParser`

## Methods

### end()

> **end**(): [`StreamingParseResult`](../interfaces/StreamingParseResult.md)

Defined in: [src/parser/streamingParser.ts:623](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L623)

Signal end of input and perform the full parse.

#### Returns

[`StreamingParseResult`](../interfaces/StreamingParseResult.md)

The streaming parse result.

#### Throws

If the PDF is malformed or cannot be parsed.

***

### feed()

> **feed**(`chunk`): `void`

Defined in: [src/parser/streamingParser.ts:592](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L592)

Feed a chunk of data to the parser.

Chunks are buffered internally. The parser does not process data
until [end](#end) is called (the PDF structure requires knowing
the full file to locate startxref).

#### Parameters

##### chunk

`Uint8Array`

#### Returns

`void`

***

### getPageContent()

> **getPageContent**(`pageIndex`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [src/parser/streamingParser.ts:767](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L767)

Get the raw content stream bytes for a specific page.

Requires that the full data has been buffered (i.e. [end](#end)
was called). Returns the raw (possibly compressed) bytes of the
page's content stream.

#### Parameters

##### pageIndex

`number`

Zero-based page index.

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

The raw content stream bytes.

***

### on()

> **on**(`event`, `handler`): `void`

Defined in: [src/parser/streamingParser.ts:563](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L563)

Register an event listener for a specific event type.

#### Parameters

##### event

`"object"` \| `"error"` \| `"header"` \| `"page"` \| `"xref"` \| `"trailer"` \| `"progress"`

##### handler

`EventHandler`

#### Returns

`void`

***

### fromFile()

> `static` **fromFile**(`path`, `options?`): `Promise`\<[`StreamingParseResult`](../interfaces/StreamingParseResult.md)\>

Defined in: [src/parser/streamingParser.ts:706](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L706)

Parse from a file path (Node.js / Deno / Bun only).

Uses dynamic import of `node:fs` to avoid bundling issues in
browsers. Falls back to `Deno.readFile` if available.

#### Parameters

##### path

`string`

##### options?

[`StreamingParserOptions`](../interfaces/StreamingParserOptions.md)

#### Returns

`Promise`\<[`StreamingParseResult`](../interfaces/StreamingParseResult.md)\>

***

### fromStream()

> `static` **fromStream**(`stream`, `options?`): `Promise`\<[`StreamingParseResult`](../interfaces/StreamingParseResult.md)\>

Defined in: [src/parser/streamingParser.ts:680](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L680)

Parse from a `ReadableStream<Uint8Array>`.

Reads all chunks from the stream, then performs the structural
parse. For truly streaming random-access, the full data must be
available to seek to startxref and the xref table.

#### Parameters

##### stream

`ReadableStream`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### options?

[`StreamingParserOptions`](../interfaces/StreamingParserOptions.md)

#### Returns

`Promise`\<[`StreamingParseResult`](../interfaces/StreamingParseResult.md)\>
