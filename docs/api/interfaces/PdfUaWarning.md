[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaWarning

# Interface: PdfUaWarning

Defined in: [src/accessibility/pdfUaValidator.ts:65](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L65)

A single PDF/UA validation warning — a best-practice recommendation.

## Properties

### code

> `readonly` **code**: `string`

Defined in: [src/accessibility/pdfUaValidator.ts:67](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L67)

Machine-readable warning code (e.g. `"UA-WARN-001"`).

***

### element?

> `readonly` `optional` **element?**: [`PdfStructureElement`](../classes/PdfStructureElement.md)

Defined in: [src/accessibility/pdfUaValidator.ts:71](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L71)

The structure element related to the warning, if any.

***

### message

> `readonly` **message**: `string`

Defined in: [src/accessibility/pdfUaValidator.ts:69](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L69)

Human-readable recommendation.

***

### pageIndex?

> `readonly` `optional` **pageIndex?**: `number`

Defined in: [src/accessibility/pdfUaValidator.ts:73](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L73)

Zero-based page index, if the warning is page-specific.
