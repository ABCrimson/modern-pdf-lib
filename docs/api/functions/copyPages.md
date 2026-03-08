[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / copyPages

# Function: copyPages()

> **copyPages**(`sourceDoc`, `targetDoc`, `indices`): [`PdfPage`](../classes/PdfPage.md)[]

Defined in: [src/core/documentMerge.ts:351](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/documentMerge.ts#L351)

Copy pages from a source document to a target document.

## Parameters

### sourceDoc

[`PdfDocument`](../classes/PdfDocument.md)

The source document.

### targetDoc

[`PdfDocument`](../classes/PdfDocument.md)

The target document.

### indices

`number`[]

Zero-based page indices to copy from the source.

## Returns

[`PdfPage`](../classes/PdfPage.md)[]

Array of new PdfPage objects added to the target.
