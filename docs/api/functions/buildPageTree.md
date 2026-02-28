[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPageTree

# Function: buildPageTree()

> **buildPageTree**(`pages`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfCatalog.ts#L158)

Build the `/Pages` tree and individual `/Page` dictionaries.

This implementation uses a flat page tree (a single `/Pages` node)
which is correct for documents with up to several thousand pages.

## Parameters

### pages

readonly [`PageEntry`](../interfaces/PageEntry.md)[]

Ordered list of page entries.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

Object registry.

## Returns

[`PdfRef`](../classes/PdfRef.md)

The indirect reference to the root `/Pages` node.
