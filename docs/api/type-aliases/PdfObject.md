[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfObject

# Type Alias: PdfObject

> **PdfObject** = [`PdfNull`](../classes/PdfNull.md) \| [`PdfBool`](../classes/PdfBool.md) \| [`PdfNumber`](../classes/PdfNumber.md) \| [`PdfString`](../classes/PdfString.md) \| [`PdfName`](../classes/PdfName.md) \| [`PdfArray`](../classes/PdfArray.md) \| [`PdfDict`](../classes/PdfDict.md) \| [`PdfStream`](../classes/PdfStream.md) \| [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfObjects.ts:434](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfObjects.ts#L434)

Union of all PDF object types.  Every member has a `serialize()` method
and a discriminating `kind` literal.
