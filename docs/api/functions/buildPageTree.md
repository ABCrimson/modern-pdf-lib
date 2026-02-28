[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPageTree

# Function: buildPageTree()

> **buildPageTree**(`pages`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfCatalog.ts:158](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/pdfCatalog.ts#L158)

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
