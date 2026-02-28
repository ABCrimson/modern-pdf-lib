[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / annotationFromDict

# Function: annotationFromDict()

> **annotationFromDict**(`dict`, `resolver?`): [`PdfAnnotation`](../classes/PdfAnnotation.md)

Defined in: [src/annotation/pdfAnnotation.ts:120](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/pdfAnnotation.ts#L120)

Create a PdfAnnotation from an existing dictionary.

## Parameters

### dict

[`PdfDict`](../classes/PdfDict.md)

The annotation dictionary.

### resolver?

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

Optional function to resolve indirect references.

## Returns

[`PdfAnnotation`](../classes/PdfAnnotation.md)

A PdfAnnotation instance.
