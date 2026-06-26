[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfObject

# Type Alias: PdfObject

```ts
type PdfObject = 
  | PdfNull
  | PdfBool
  | PdfNumber
  | PdfString
  | PdfName
  | PdfArray
  | PdfDict
  | PdfStream
  | PdfRef;
```

Defined in: [src/core/pdfObjects.ts:444](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfObjects.ts#L444)

Union of all PDF object types.  Every member has a `serialize()` method
and a discriminating `kind` literal.
