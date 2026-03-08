[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createXmpStream

# Function: createXmpStream()

> **createXmpStream**(`meta`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/metadata/xmpMetadata.ts:280](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/metadata/xmpMetadata.ts#L280)

Create an XMP metadata stream suitable for embedding in a PDF
catalog's `/Metadata` entry.

The stream is created with:
- `/Type /Metadata`
- `/Subtype /XML`
- The XMP XML as uncompressed stream data

## Parameters

### meta

[`DocumentMetadata`](../interfaces/DocumentMetadata.md)

Document metadata.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

Object registry for allocating a reference.

## Returns

[`PdfRef`](../classes/PdfRef.md)

The indirect reference to the metadata stream.
