[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RefResolver

# Type Alias: RefResolver()

> **RefResolver** = (`ref`) => [`PdfObject`](PdfObject.md)

Defined in: [src/form/pdfForm.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/form/pdfForm.ts#L40)

Function that resolves a PdfRef to its underlying PdfObject.
Used when traversing the field tree from parsed PDF data.

## Parameters

### ref

[`PdfRef`](../classes/PdfRef.md)

## Returns

[`PdfObject`](PdfObject.md)
