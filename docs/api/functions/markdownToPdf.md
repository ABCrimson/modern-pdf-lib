[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / markdownToPdf

# Function: markdownToPdf()

```ts
function markdownToPdf(markdown, options?): Promise<Uint8Array<ArrayBufferLike>>;
```

Defined in: [src/assets/markdown/markdownToPdf.ts:60](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/assets/markdown/markdownToPdf.ts#L60)

Convert a CommonMark **subset** string into PDF bytes.

## Parameters

### markdown

`string`

The Markdown source text.

### options?

[`MarkdownToPdfOptions`](../interfaces/MarkdownToPdfOptions.md)

Optional layout options ([MarkdownToPdfOptions](../interfaces/MarkdownToPdfOptions.md)).

## Returns

`Promise`\&lt;`Uint8Array`\&lt;`ArrayBufferLike`\&gt;\&gt;

A promise resolving to the saved PDF as a `Uint8Array`.
