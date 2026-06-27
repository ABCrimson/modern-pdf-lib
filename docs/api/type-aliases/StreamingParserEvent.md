[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingParserEvent

# Type Alias: StreamingParserEvent

```ts
type StreamingParserEvent = 
  | {
  type: "header";
  version: string;
}
  | {
  entries: number;
  offset: number;
  type: "xref";
}
  | {
  dict: Record<string, unknown>;
  type: "trailer";
}
  | {
  index: number;
  page: ParsedPage;
  type: "page";
}
  | {
  generation: number;
  number: number;
  offset: number;
  type: "object";
}
  | {
  bytesRead: number;
  totalBytes: number;
  type: "progress";
}
  | {
  message: string;
  offset: number;
  type: "error";
};
```

Defined in: [src/parser/streamingParser.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/streamingParser.ts#L90)

Events emitted during streaming parsing.
