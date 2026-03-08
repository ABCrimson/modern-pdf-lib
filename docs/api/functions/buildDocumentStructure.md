[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDocumentStructure

# Function: buildDocumentStructure()

> **buildDocumentStructure**(`pages`, `meta`, `registry`, `options?`): [`DocumentStructure`](../interfaces/DocumentStructure.md)

Defined in: [src/core/pdfCatalog.ts:327](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/pdfCatalog.ts#L327)

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
