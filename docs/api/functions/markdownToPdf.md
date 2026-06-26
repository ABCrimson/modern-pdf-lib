[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / markdownToPdf

# Function: markdownToPdf()

> **markdownToPdf**(`markdown`, `options?`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: src/assets/markdown/markdownToPdf.ts:60

Convert a CommonMark **subset** string into PDF bytes.

## Parameters

### markdown

`string`

The Markdown source text.

### options?

[`MarkdownToPdfOptions`](../interfaces/MarkdownToPdfOptions.md)

Optional layout options ([MarkdownToPdfOptions](../interfaces/MarkdownToPdfOptions.md)).

## Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

A promise resolving to the saved PDF as a `Uint8Array`.
