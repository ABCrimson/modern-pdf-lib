[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPdfA4Xmp

# Function: buildPdfA4Xmp()

> **buildPdfA4Xmp**(`options?`): `string`

Defined in: src/compliance/pdfA4.ts:148

Build a complete XMP metadata packet for a PDF/A-4 document.

The packet declares the mandatory PDF/A identification fields
(`pdfaid:part = 4`, `pdfaid:rev = 2020`, and `pdfaid:conformance`
for the `e`/`f` variants), an optional `dc:title`, and a
`pdfaExtension:schemas` bag describing any supplied extension schemas.

## Parameters

### options?

[`PdfA4Options`](../interfaces/PdfA4Options.md)

PDF/A-4 metadata options.

## Returns

`string`

A well-formed XMP packet as a string.
