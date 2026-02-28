[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / createAnnotation

# Function: createAnnotation()

> **createAnnotation**(`type`, `options`): [`PdfAnnotation`](../classes/PdfAnnotation.md)

Defined in: [src/annotation/pdfAnnotation.ts:207](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/annotation/pdfAnnotation.ts#L207)

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
