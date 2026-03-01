[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDocumentStructure

# Function: buildDocumentStructure()

> **buildDocumentStructure**(`pages`, `meta`, `registry`, `options?`): [`DocumentStructure`](../interfaces/DocumentStructure.md)

Defined in: [src/core/pdfCatalog.ts:320](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfCatalog.ts#L320)

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
