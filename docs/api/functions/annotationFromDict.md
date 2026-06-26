[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / annotationFromDict

# Function: annotationFromDict()

```ts
function annotationFromDict(dict, _resolver?): PdfAnnotation;
```

Defined in: [src/annotation/pdfAnnotation.ts:130](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L130)

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
