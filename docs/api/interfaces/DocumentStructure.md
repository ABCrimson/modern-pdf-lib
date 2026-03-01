[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocumentStructure

# Interface: DocumentStructure

Defined in: [src/core/pdfCatalog.ts:303](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfCatalog.ts#L303)

High-level helper that wires together the catalog, page tree, and info
dict, returning all the references the writer needs.

## Properties

### catalogRef

> **catalogRef**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:305](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfCatalog.ts#L305)

Reference to the /Catalog.

***

### infoRef

> **infoRef**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:307](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfCatalog.ts#L307)

Reference to the /Info dict.

***

### pagesRef

> **pagesRef**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:309](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/core/pdfCatalog.ts#L309)

Reference to the /Pages node.
