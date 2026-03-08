[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createXmpStream

# Function: createXmpStream()

> **createXmpStream**(`meta`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/metadata/xmpMetadata.ts:280](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/metadata/xmpMetadata.ts#L280)

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
