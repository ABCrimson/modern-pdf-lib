[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateFreeTextAppearance

# Function: generateFreeTextAppearance()

> **generateFreeTextAppearance**(`annot`): [`PdfStream`](../classes/PdfStream.md)

Defined in: [src/annotation/appearanceGenerator.ts:525](https://github.com/ABCrimson/modern-pdf-lib/blob/ca8606e1bf65904fde5f1faa25932bc860f3b8d2/src/annotation/appearanceGenerator.ts#L525)

Generate appearance stream for a FreeText annotation.

This requires access to the annotation's text, default appearance
string, and alignment.  We accept the annotation object directly
to access these properties.

## Parameters

### annot

[`PdfAnnotation`](../classes/PdfAnnotation.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
