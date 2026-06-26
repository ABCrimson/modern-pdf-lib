[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingParserOptions

# Interface: StreamingParserOptions

Defined in: [src/parser/streamingParser.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L35)

Options for the streaming PDF parser.

## Properties

### maxBufferSize?

> `optional` **maxBufferSize?**: `number`

Defined in: [src/parser/streamingParser.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L37)

Maximum bytes to buffer at once. Default: 64 MB.

***

### pageRange?

> `optional` **pageRange?**: `object`

Defined in: [src/parser/streamingParser.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L41)

Pages to parse (for selective loading). Default: all.

#### end?

> `optional` **end?**: `number`

#### start?

> `optional` **start?**: `number`

***

### parseContentStreams?

> `optional` **parseContentStreams?**: `boolean`

Defined in: [src/parser/streamingParser.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L39)

Whether to parse content streams. Default: false.
