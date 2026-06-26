[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createAnnotation

# Function: createAnnotation()

> **createAnnotation**(`type`, `options`): [`PdfAnnotation`](../classes/PdfAnnotation.md)

Defined in: [src/annotation/pdfAnnotation.ts:217](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L217)

Create a new annotation with the given type and options.

This is a convenience function that creates a generic PdfAnnotation.
For type-specific annotations, use the subclass `create()` methods.

## Parameters

### type

[`AnnotationType`](../type-aliases/AnnotationType.md)

The annotation subtype.

### options

[`AnnotationOptions`](../interfaces/AnnotationOptions.md)

Creation options (rect, contents, etc.).

## Returns

[`PdfAnnotation`](../classes/PdfAnnotation.md)

A new PdfAnnotation instance.
