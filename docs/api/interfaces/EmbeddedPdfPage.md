[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EmbeddedPdfPage

# Interface: EmbeddedPdfPage

Defined in: [src/core/pdfEmbed.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L44)

Handle for a page that has been embedded as a Form XObject.

Returned by `PdfDocument.embedPdf()` and `PdfDocument.embedPage()`.
Pass it to `PdfPage.drawPage()` to paint the embedded page.

## Properties

### height

> `readonly` **height**: `number`

Defined in: [src/core/pdfEmbed.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L52)

Original page height in points.

***

### name

> `readonly` **name**: `string`

Defined in: [src/core/pdfEmbed.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L46)

XObject resource name (e.g. `'XF1'`).

***

### ref

> `readonly` **ref**: [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/core/pdfEmbed.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L48)

Indirect reference to the Form XObject in the target registry.

***

### width

> `readonly` **width**: `number`

Defined in: [src/core/pdfEmbed.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L50)

Original page width in points.

## Methods

### scale()

> **scale**(`factor`): `object`

Defined in: [src/core/pdfEmbed.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L59)

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

Defined in: [src/core/pdfEmbed.ts:68](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/core/pdfEmbed.ts#L68)

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
