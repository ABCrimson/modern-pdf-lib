[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / TextParagraph

# Interface: TextParagraph

Defined in: src/parser/textReconstruct.ts:42

A reconstructed paragraph: a run of vertically-adjacent lines.

## Properties

### lines

> `readonly` **lines**: readonly [`TextLine`](TextLine.md)[]

Defined in: src/parser/textReconstruct.ts:46

The lines that make up this paragraph, in top-to-bottom reading order.

***

### text

> `readonly` **text**: `string`

Defined in: src/parser/textReconstruct.ts:44

The joined text content of the paragraph (lines joined with `"\n"`).
