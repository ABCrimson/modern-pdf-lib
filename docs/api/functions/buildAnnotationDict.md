[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildAnnotationDict

# Function: buildAnnotationDict()

> **buildAnnotationDict**(`type`, `options`): [`PdfDict`](../classes/PdfDict.md)

Defined in: [src/annotation/pdfAnnotation.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L155)

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
