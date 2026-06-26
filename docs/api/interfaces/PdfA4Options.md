[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfA4Options

# Interface: PdfA4Options

Defined in: src/compliance/pdfA4.ts:58

Options for generating PDF/A-4 XMP metadata.

## Properties

### extensionSchemas?

> `readonly` `optional` **extensionSchemas?**: readonly [`PdfA4ExtensionSchema`](PdfA4ExtensionSchema.md)[]

Defined in: src/compliance/pdfA4.ts:64

Extension schemas to declare under `pdfaExtension:schemas`.

***

### level?

> `readonly` `optional` **level?**: [`PdfA4Level`](../type-aliases/PdfA4Level.md)

Defined in: src/compliance/pdfA4.ts:60

Conformance variant. Default: `'PDF/A-4'`.

***

### title?

> `readonly` `optional` **title?**: `string`

Defined in: src/compliance/pdfA4.ts:62

Document title (Dublin Core `dc:title`).
