[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedFontOptions

# Interface: EmbedFontOptions

Defined in: [src/core/pdfDocument.ts:107](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfDocument.ts#L107)

Options for font embedding.

## Properties

### customName?

> `optional` **customName**: `string`

Defined in: [src/core/pdfDocument.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfDocument.ts#L113)

Custom name to use in the font dictionary's /BaseFont instead of the font's PostScript name.

***

### features?

> `optional` **features**: `Record`\<`string`, `boolean`\>

Defined in: [src/core/pdfDocument.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfDocument.ts#L111)

OpenType feature flags. e.g., { kern: true, liga: true }.

***

### subset?

> `optional` **subset**: `boolean`

Defined in: [src/core/pdfDocument.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfDocument.ts#L109)

Whether to subset the font to reduce file size. Default: true.
