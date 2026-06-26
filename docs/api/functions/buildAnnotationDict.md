[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildAnnotationDict

# Function: buildAnnotationDict()

```ts
function buildAnnotationDict(type, options): PdfDict;
```

Defined in: [src/annotation/pdfAnnotation.ts:155](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/annotation/pdfAnnotation.ts#L155)

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
