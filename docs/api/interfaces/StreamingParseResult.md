[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingParseResult

# Interface: StreamingParseResult

Defined in: [src/parser/streamingParser.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L70)

The result of a streaming parse operation.

## Properties

### isEncrypted

> **isEncrypted**: `boolean`

Defined in: [src/parser/streamingParser.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L80)

Whether the PDF is encrypted.

***

### isLinearized

> **isLinearized**: `boolean`

Defined in: [src/parser/streamingParser.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L82)

Whether the PDF is linearized (web-optimized).

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `string`\>

Defined in: [src/parser/streamingParser.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L78)

Document metadata from /Info dictionary.

***

### pageCount

> **pageCount**: `number`

Defined in: [src/parser/streamingParser.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L74)

Total number of pages in the document.

***

### pages

> **pages**: [`ParsedPage`](ParsedPage.md)[]

Defined in: [src/parser/streamingParser.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L76)

Parsed page metadata.

***

### version

> **version**: `string`

Defined in: [src/parser/streamingParser.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L72)

PDF version string (e.g. "1.7", "2.0").

***

### xrefOffset

> **xrefOffset**: `number`

Defined in: [src/parser/streamingParser.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L84)

Byte offset of the cross-reference section.
