[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildXmpMetadata

# Function: buildXmpMetadata()

> **buildXmpMetadata**(`meta`): `string`

Defined in: [src/metadata/xmpMetadata.ts:89](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/xmpMetadata.ts#L89)

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
