[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildCatalog

# Function: buildCatalog()

```ts
function buildCatalog(
   pagesRef, 
   registry, 
   options?): PdfRef;
```

Defined in: [src/core/pdfCatalog.ts:280](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L280)

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
