[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DocumentStructure

# Interface: DocumentStructure

Defined in: [src/core/pdfCatalog.ts:303](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfCatalog.ts#L303)

High-level helper that wires together the catalog, page tree, and info
dict, returning all the references the writer needs.

## Properties

### catalogRef

> **catalogRef**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:305](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfCatalog.ts#L305)

Reference to the /Catalog.

***

### infoRef

> **infoRef**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:307](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfCatalog.ts#L307)

Reference to the /Info dict.

***

### pagesRef

> **pagesRef**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:309](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfCatalog.ts#L309)

Reference to the /Pages node.
