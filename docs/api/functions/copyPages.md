[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / copyPages

# Function: copyPages()

> **copyPages**(`sourceDoc`, `targetDoc`, `indices`): [`PdfPage`](../classes/PdfPage.md)[]

Defined in: [src/core/documentMerge.ts:351](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/core/documentMerge.ts#L351)

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
