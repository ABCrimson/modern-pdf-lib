[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildInfoDict

# Function: buildInfoDict()

> **buildInfoDict**(`meta`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfCatalog.ts#L73)

Build the `/Info` dictionary from metadata.

## Parameters

### meta

[`DocumentMetadata`](../interfaces/DocumentMetadata.md)

Document metadata.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

Object registry — the info dict is registered as an
                 indirect object.

## Returns

[`PdfRef`](../classes/PdfRef.md)

The indirect reference to the `/Info` dict.
