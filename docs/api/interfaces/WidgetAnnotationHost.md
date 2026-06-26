[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WidgetAnnotationHost

# Interface: WidgetAnnotationHost

Defined in: [src/form/pdfField.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L31)

Minimal interface for a PDF page that can receive widget annotations.
Used by [PdfField.addToPage](../classes/PdfField.md#addtopage) to avoid importing PdfPage directly.

## Methods

### addWidgetAnnotation()

```ts
addWidgetAnnotation(widgetDict): void;
```

Defined in: [src/form/pdfField.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/form/pdfField.ts#L33)

Add a raw widget annotation dictionary to this page.

#### Parameters

##### widgetDict

[`PdfDict`](../classes/PdfDict.md)

#### Returns

`void`
