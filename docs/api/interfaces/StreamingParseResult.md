[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingParseResult

# Interface: StreamingParseResult

Defined in: [src/parser/streamingParser.ts:70](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L70)

The result of a streaming parse operation.

## Properties

### isEncrypted

```ts
isEncrypted: boolean;
```

Defined in: [src/parser/streamingParser.ts:80](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L80)

Whether the PDF is encrypted.

***

### isLinearized

```ts
isLinearized: boolean;
```

Defined in: [src/parser/streamingParser.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L82)

Whether the PDF is linearized (web-optimized).

***

### metadata?

```ts
optional metadata?: Record<string, string>;
```

Defined in: [src/parser/streamingParser.ts:78](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L78)

Document metadata from /Info dictionary.

***

### pageCount

```ts
pageCount: number;
```

Defined in: [src/parser/streamingParser.ts:74](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L74)

Total number of pages in the document.

***

### pages

```ts
pages: ParsedPage[];
```

Defined in: [src/parser/streamingParser.ts:76](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L76)

Parsed page metadata.

***

### version

```ts
version: string;
```

Defined in: [src/parser/streamingParser.ts:72](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L72)

PDF version string (e.g. "1.7", "2.0").

***

### xrefOffset

```ts
xrefOffset: number;
```

Defined in: [src/parser/streamingParser.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L84)

Byte offset of the cross-reference section.
