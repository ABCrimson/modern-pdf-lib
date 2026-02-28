[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfObject

# Type Alias: PdfObject

> **PdfObject** = [`PdfNull`](../classes/PdfNull.md) \| [`PdfBool`](../classes/PdfBool.md) \| [`PdfNumber`](../classes/PdfNumber.md) \| [`PdfString`](../classes/PdfString.md) \| [`PdfName`](../classes/PdfName.md) \| [`PdfArray`](../classes/PdfArray.md) \| [`PdfDict`](../classes/PdfDict.md) \| [`PdfStream`](../classes/PdfStream.md) \| [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfObjects.ts:434](https://github.com/ABCrimson/modern-pdf-lib/blob/dc35af75ebbef66c07ef507cafc3a644f376c837/src/core/pdfObjects.ts#L434)

Union of all PDF object types.  Every member has a `serialize()` method
and a discriminating `kind` literal.
