[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDocumentStructure

# Function: buildDocumentStructure()

> **buildDocumentStructure**(`pages`, `meta`, `registry`, `options?`): [`DocumentStructure`](../interfaces/DocumentStructure.md)

Defined in: [src/core/pdfCatalog.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfCatalog.ts#L320)

Build the complete document structure.

## Parameters

### pages

readonly [`PageEntry`](../interfaces/PageEntry.md)[]

Page entries (already have refs allocated).

### meta

[`DocumentMetadata`](../interfaces/DocumentMetadata.md)

Document metadata.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

Object registry.

### options?

[`CatalogOptions`](../interfaces/CatalogOptions.md)

Optional catalog settings.

## Returns

[`DocumentStructure`](../interfaces/DocumentStructure.md)
