[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RefResolver

# Type Alias: RefResolver()

> **RefResolver** = (`ref`) => [`PdfObject`](PdfObject.md)

Defined in: [src/form/pdfForm.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/form/pdfForm.ts#L40)

Function that resolves a PdfRef to its underlying PdfObject.
Used when traversing the field tree from parsed PDF data.

## Parameters

### ref

[`PdfRef`](../classes/PdfRef.md)

## Returns

[`PdfObject`](PdfObject.md)
