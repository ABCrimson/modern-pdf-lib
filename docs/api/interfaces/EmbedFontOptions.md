[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedFontOptions

# Interface: EmbedFontOptions

Defined in: [src/core/pdfDocument.ts:109](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfDocument.ts#L109)

Options for font embedding.

## Properties

### customName?

> `optional` **customName**: `string`

Defined in: [src/core/pdfDocument.ts:115](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfDocument.ts#L115)

Custom name to use in the font dictionary's /BaseFont instead of the font's PostScript name.

***

### features?

> `optional` **features**: `Record`\<`string`, `boolean`\>

Defined in: [src/core/pdfDocument.ts:113](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfDocument.ts#L113)

OpenType feature flags. e.g., { kern: true, liga: true }.

***

### subset?

> `optional` **subset**: `boolean`

Defined in: [src/core/pdfDocument.ts:111](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfDocument.ts#L111)

Whether to subset the font to reduce file size. Default: true.
