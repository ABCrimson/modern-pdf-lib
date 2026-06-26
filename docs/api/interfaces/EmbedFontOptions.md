[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedFontOptions

# Interface: EmbedFontOptions

Defined in: [src/core/pdfDocument.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfDocument.ts#L118)

Options for font embedding.

## Properties

### customName?

> `optional` **customName?**: `string`

Defined in: [src/core/pdfDocument.ts:124](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfDocument.ts#L124)

Custom name to use in the font dictionary's /BaseFont instead of the font's PostScript name.

***

### features?

> `optional` **features?**: `Record`\<`string`, `boolean`\>

Defined in: [src/core/pdfDocument.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfDocument.ts#L122)

OpenType feature flags. e.g., { kern: true, liga: true }.

***

### subset?

> `optional` **subset?**: `boolean`

Defined in: [src/core/pdfDocument.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfDocument.ts#L120)

Whether to subset the font to reduce file size. Default: true.
