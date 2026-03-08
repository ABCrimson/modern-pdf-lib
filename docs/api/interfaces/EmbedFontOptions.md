[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbedFontOptions

# Interface: EmbedFontOptions

Defined in: [src/core/pdfDocument.ts:116](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfDocument.ts#L116)

Options for font embedding.

## Properties

### customName?

> `optional` **customName**: `string`

Defined in: [src/core/pdfDocument.ts:122](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfDocument.ts#L122)

Custom name to use in the font dictionary's /BaseFont instead of the font's PostScript name.

***

### features?

> `optional` **features**: `Record`\<`string`, `boolean`\>

Defined in: [src/core/pdfDocument.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfDocument.ts#L120)

OpenType feature flags. e.g., { kern: true, liga: true }.

***

### subset?

> `optional` **subset**: `boolean`

Defined in: [src/core/pdfDocument.ts:118](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfDocument.ts#L118)

Whether to subset the font to reduce file size. Default: true.
