[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingParserOptions

# Interface: StreamingParserOptions

Defined in: [src/parser/streamingParser.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L35)

Options for the streaming PDF parser.

## Properties

### maxBufferSize?

```ts
optional maxBufferSize?: number;
```

Defined in: [src/parser/streamingParser.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L37)

Maximum bytes to buffer at once. Default: 64 MB.

***

### pageRange?

```ts
optional pageRange?: object;
```

Defined in: [src/parser/streamingParser.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L41)

Pages to parse (for selective loading). Default: all.

#### end?

```ts
optional end?: number;
```

#### start?

```ts
optional start?: number;
```

***

### parseContentStreams?

```ts
optional parseContentStreams?: boolean;
```

Defined in: [src/parser/streamingParser.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L39)

Whether to parse content streams. Default: false.
