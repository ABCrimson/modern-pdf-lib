[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / generateFreeTextAppearance

# Function: generateFreeTextAppearance()

```ts
function generateFreeTextAppearance(annot): PdfStream;
```

Defined in: [src/annotation/appearanceGenerator.ts:525](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/appearanceGenerator.ts#L525)

Generate appearance stream for a FreeText annotation.

This requires access to the annotation's text, default appearance
string, and alignment.  We accept the annotation object directly
to access these properties.

## Parameters

### annot

[`PdfAnnotation`](../classes/PdfAnnotation.md)

## Returns

[`PdfStream`](../classes/PdfStream.md)
