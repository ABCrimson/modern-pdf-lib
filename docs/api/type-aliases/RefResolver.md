[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / RefResolver

# Type Alias: RefResolver

```ts
type RefResolver = (ref) => PdfObject;
```

Defined in: [src/form/pdfForm.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfForm.ts#L40)

Function that resolves a PdfRef to its underlying PdfObject.
Used when traversing the field tree from parsed PDF data.

## Parameters

### ref

[`PdfRef`](../classes/PdfRef.md)

## Returns

[`PdfObject`](PdfObject.md)
