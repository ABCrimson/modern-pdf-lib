[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / StreamingParserEvent

# Type Alias: StreamingParserEvent

> **StreamingParserEvent** = \{ `type`: `"header"`; `version`: `string`; \} \| \{ `entries`: `number`; `offset`: `number`; `type`: `"xref"`; \} \| \{ `dict`: `Record`\<`string`, `unknown`\>; `type`: `"trailer"`; \} \| \{ `index`: `number`; `page`: [`ParsedPage`](../interfaces/ParsedPage.md); `type`: `"page"`; \} \| \{ `generation`: `number`; `number`: `number`; `offset`: `number`; `type`: `"object"`; \} \| \{ `bytesRead`: `number`; `totalBytes`: `number`; `type`: `"progress"`; \} \| \{ `message`: `string`; `offset`: `number`; `type`: `"error"`; \}

Defined in: [src/parser/streamingParser.ts:90](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/parser/streamingParser.ts#L90)

Events emitted during streaming parsing.
