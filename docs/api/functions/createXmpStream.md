[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createXmpStream

# Function: createXmpStream()

> **createXmpStream**(`meta`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/metadata/xmpMetadata.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/metadata/xmpMetadata.ts#L275)

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
