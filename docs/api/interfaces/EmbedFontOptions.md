[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedFontOptions

# Interface: EmbedFontOptions

Defined in: [src/core/pdfDocument.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfDocument.ts#L110)

Options for font embedding.

## Properties

### customName?

> `optional` **customName**: `string`

Defined in: [src/core/pdfDocument.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfDocument.ts#L116)

Custom name to use in the font dictionary's /BaseFont instead of the font's PostScript name.

***

### features?

> `optional` **features**: `Record`\<`string`, `boolean`\>

Defined in: [src/core/pdfDocument.ts:114](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfDocument.ts#L114)

OpenType feature flags. e.g., { kern: true, liga: true }.

***

### subset?

> `optional` **subset**: `boolean`

Defined in: [src/core/pdfDocument.ts:112](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfDocument.ts#L112)

Whether to subset the font to reduce file size. Default: true.
