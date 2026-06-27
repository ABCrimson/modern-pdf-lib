[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / annotationFromDict

# Function: annotationFromDict()

```ts
function annotationFromDict(dict, _resolver?): PdfAnnotation;
```

Defined in: [src/annotation/pdfAnnotation.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/annotation/pdfAnnotation.ts#L130)

Create a PdfAnnotation from an existing dictionary.

## Parameters

### dict

[`PdfDict`](../classes/PdfDict.md)

The annotation dictionary.

### \_resolver?

(`ref`) =&gt; [`PdfObject`](../type-aliases/PdfObject.md) \| `undefined`

## Returns

[`PdfAnnotation`](../classes/PdfAnnotation.md)

A PdfAnnotation instance.
