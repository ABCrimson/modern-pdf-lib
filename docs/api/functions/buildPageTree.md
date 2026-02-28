[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPageTree

# Function: buildPageTree()

> **buildPageTree**(`pages`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfCatalog.ts#L158)

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
