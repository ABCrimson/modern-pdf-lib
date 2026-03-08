[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generatePdfAXmpBytes

# Function: generatePdfAXmpBytes()

> **generatePdfAXmpBytes**(`options`): `Uint8Array`

Defined in: [src/compliance/xmpGenerator.ts:165](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/compliance/xmpGenerator.ts#L165)

Generate XMP metadata bytes for embedding in a PDF stream.

This is a convenience wrapper around [generatePdfAXmp](generatePdfAXmp.md) that
encodes the resulting string as UTF-8 bytes suitable for use in a
PDF metadata stream object.

## Parameters

### options

[`PdfAXmpOptions`](../interfaces/PdfAXmpOptions.md)

Metadata options.

## Returns

`Uint8Array`

XMP metadata as a `Uint8Array`.
