[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextParagraph

# Interface: TextParagraph

Defined in: [src/parser/textReconstruct.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textReconstruct.ts#L42)

A reconstructed paragraph: a run of vertically-adjacent lines.

## Properties

### lines

```ts
readonly lines: readonly TextLine[];
```

Defined in: [src/parser/textReconstruct.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textReconstruct.ts#L46)

The lines that make up this paragraph, in top-to-bottom reading order.

***

### text

```ts
readonly text: string;
```

Defined in: [src/parser/textReconstruct.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/parser/textReconstruct.ts#L44)

The joined text content of the paragraph (lines joined with `"\n"`).
