[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildDocumentStructure

# Function: buildDocumentStructure()

```ts
function buildDocumentStructure(
   pages, 
   meta, 
   registry, 
   options?): DocumentStructure;
```

Defined in: [src/core/pdfCatalog.ts:327](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L327)

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
