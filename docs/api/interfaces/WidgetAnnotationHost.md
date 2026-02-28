[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / WidgetAnnotationHost

# Interface: WidgetAnnotationHost

Defined in: [src/form/pdfField.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/form/pdfField.ts#L31)

Minimal interface for a PDF page that can receive widget annotations.
Used by [PdfField.addToPage](../classes/PdfField.md#addtopage) to avoid importing PdfPage directly.

## Methods

### addWidgetAnnotation()

> **addWidgetAnnotation**(`widgetDict`): `void`

Defined in: [src/form/pdfField.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/form/pdfField.ts#L33)

Add a raw widget annotation dictionary to this page.

#### Parameters

##### widgetDict

[`PdfDict`](../classes/PdfDict.md)

#### Returns

`void`
