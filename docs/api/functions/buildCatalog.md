[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildCatalog

# Function: buildCatalog()

> **buildCatalog**(`pagesRef`, `registry`, `options?`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:280](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfCatalog.ts#L280)

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
