[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfObject

# Type Alias: PdfObject

> **PdfObject** = [`PdfNull`](../classes/PdfNull.md) \| [`PdfBool`](../classes/PdfBool.md) \| [`PdfNumber`](../classes/PdfNumber.md) \| [`PdfString`](../classes/PdfString.md) \| [`PdfName`](../classes/PdfName.md) \| [`PdfArray`](../classes/PdfArray.md) \| [`PdfDict`](../classes/PdfDict.md) \| [`PdfStream`](../classes/PdfStream.md) \| [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfObjects.ts:444](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/core/pdfObjects.ts#L444)

Union of all PDF object types.  Every member has a `serialize()` method
and a discriminating `kind` literal.
