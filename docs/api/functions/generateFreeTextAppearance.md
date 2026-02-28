[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateFreeTextAppearance

# Function: generateFreeTextAppearance()

> **generateFreeTextAppearance**(`annot`): [`PdfStream`](../classes/PdfStream.md)

Defined in: [src/annotation/appearanceGenerator.ts:525](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/annotation/appearanceGenerator.ts#L525)

Generate appearance stream for a FreeText annotation.

This requires access to the annotation's text, default appearance
string, and alignment.  We accept the annotation object directly
to access these properties.

## Parameters

### annot

[`PdfAnnotation`](../classes/PdfAnnotation.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
