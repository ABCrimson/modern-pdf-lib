[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildAnnotationDict

# Function: buildAnnotationDict()

> **buildAnnotationDict**(`type`, `options`): [`PdfDict`](../classes/PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:145](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/annotation/pdfAnnotation.ts#L145)

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
