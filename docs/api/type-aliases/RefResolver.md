[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RefResolver

# Type Alias: RefResolver

> **RefResolver** = (`ref`) => [`PdfObject`](PdfObject.md)

Defined in: [src/form/pdfForm.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/form/pdfForm.ts#L40)

Function that resolves a PdfRef to its underlying PdfObject.
Used when traversing the field tree from parsed PDF data.

## Parameters

### ref

[`PdfRef`](../classes/PdfRef.md)

## Returns

[`PdfObject`](PdfObject.md)
