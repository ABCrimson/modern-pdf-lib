[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / copyPages

# Function: copyPages()

```ts
function copyPages(
   sourceDoc, 
   targetDoc, 
   indices): PdfPage[];
```

Defined in: [src/core/documentMerge.ts:350](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/documentMerge.ts#L350)

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
