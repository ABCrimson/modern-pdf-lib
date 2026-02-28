[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbeddedPdfPage

# Interface: EmbeddedPdfPage

Defined in: [src/core/pdfEmbed.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfEmbed.ts#L43)

Handle for a page that has been embedded as a Form XObject.

Returned by `PdfDocument.embedPdf()` and `PdfDocument.embedPage()`.
Pass it to `PdfPage.drawPage()` to paint the embedded page.

## Properties

### height

> `readonly` **height**: `number`

Defined in: [src/core/pdfEmbed.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfEmbed.ts#L51)

Original page height in points.

***

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfEmbed.ts:45](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfEmbed.ts#L45)

XObject resource name (e.g. `'XF1'`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfEmbed.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfEmbed.ts#L47)

Indirect reference to the Form XObject in the target registry.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/pdfEmbed.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfEmbed.ts#L49)

Original page width in points.

## Methods

### scale()

> **scale**(`factor`): `object`

Defined in: [src/core/pdfEmbed.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfEmbed.ts#L58)

Return the dimensions after applying a uniform scale factor.

#### Parameters

##### factor

`number`

Scale factor (e.g. `0.5` for half size).

#### Returns

`object`

##### height

> **height**: `number`

##### width

> **width**: `number`

***

### scaleToFit()

> **scaleToFit**(`maxW`, `maxH`): `object`

Defined in: [src/core/pdfEmbed.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfEmbed.ts#L67)

Compute dimensions that fit within the given maximum size while
preserving the original aspect ratio.

#### Parameters

##### maxW

`number`

Maximum width.

##### maxH

`number`

Maximum height.

#### Returns

`object`

##### height

> **height**: `number`

##### width

> **width**: `number`
