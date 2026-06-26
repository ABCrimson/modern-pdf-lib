[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / annotationFromDict

# Function: annotationFromDict()

> **annotationFromDict**(`dict`, `_resolver?`): [`PdfAnnotation`](../classes/PdfAnnotation.md)

Defined in: [src/annotation/pdfAnnotation.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/annotation/pdfAnnotation.ts#L130)

Create a PdfAnnotation from an existing dictionary.

## Parameters

### dict

[`PdfDict`](../classes/PdfDict.md)

The annotation dictionary.

### \_resolver?

(`ref`) => [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

## Returns

[`PdfAnnotation`](../classes/PdfAnnotation.md)

A PdfAnnotation instance.
