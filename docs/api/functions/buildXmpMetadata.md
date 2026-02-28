[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildXmpMetadata

# Function: buildXmpMetadata()

> **buildXmpMetadata**(`meta`): `string`

Defined in: [src/metadata/xmpMetadata.ts:84](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/metadata/xmpMetadata.ts#L84)

Build an XMP metadata XML string from document metadata.

The output is a complete XMP packet including:
- `<?xpacket begin="..." id="..."?>` header
- `<x:xmpmeta>` root element
- RDF description with Dublin Core, XMP, and PDF properties
- `<?xpacket end="w"?>` trailer

## Parameters

### meta

[`DocumentMetadata`](../interfaces/DocumentMetadata.md)

Document metadata fields.

## Returns

`string`

The complete XMP XML string.
