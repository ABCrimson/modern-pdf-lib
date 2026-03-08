[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildAnnotationDict

# Function: buildAnnotationDict()

> **buildAnnotationDict**(`type`, `options`): [`PdfDict`](../classes/PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/annotation/pdfAnnotation.ts#L145)

Build an annotation dictionary from options.

Used internally by subclass factory methods to populate common
annotation dictionary entries.

## Parameters

### type

[`AnnotationType`](../type-aliases/AnnotationType.md)

The annotation subtype.

### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md)

Creation options.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A populated PdfDict.
