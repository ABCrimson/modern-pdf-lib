[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildCatalog

# Function: buildCatalog()

> **buildCatalog**(`pagesRef`, `registry`, `options?`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:273](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/core/pdfCatalog.ts#L273)

Build the `/Catalog` dictionary.

## Parameters

### pagesRef

[`PdfRef`](../classes/PdfRef.md)

Indirect reference to the root `/Pages` node.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

Object registry.

### options?

[`CatalogOptions`](../interfaces/CatalogOptions.md)

Optional catalog-level settings.

## Returns

[`PdfRef`](../classes/PdfRef.md)

The indirect reference to the `/Catalog` dict.
