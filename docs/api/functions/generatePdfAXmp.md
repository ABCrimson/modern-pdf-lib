[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generatePdfAXmp

# Function: generatePdfAXmp()

> **generatePdfAXmp**(`options`): `string`

Defined in: [src/compliance/xmpGenerator.ts:86](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/compliance/xmpGenerator.ts#L86)

Generate a complete XMP metadata packet for PDF/A.

The returned string is a well-formed XMP packet wrapped in
`<?xpacket ...?>` processing instructions and containing separate
`rdf:Description` blocks for each namespace.

## Parameters

### options

[`PdfAXmpOptions`](../interfaces/PdfAXmpOptions.md)

Metadata options including the mandatory `part`
                 and `conformance` fields.

## Returns

`string`

XMP metadata as a string.
