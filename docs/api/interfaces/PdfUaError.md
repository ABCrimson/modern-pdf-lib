[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaError

# Interface: PdfUaError

Defined in: [src/accessibility/pdfUaValidator.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L49)

A single PDF/UA validation error — a must-fix violation.

## Properties

### clause?

> `readonly` `optional` **clause?**: `string`

Defined in: [src/accessibility/pdfUaValidator.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L55)

The ISO 14289-1 clause reference, if applicable.

***

### code

> `readonly` **code**: `string`

Defined in: [src/accessibility/pdfUaValidator.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L51)

Machine-readable error code (e.g. `"UA-STRUCT-001"`).

***

### element?

> `readonly` `optional` **element?**: [`PdfStructureElement`](../classes/PdfStructureElement.md)

Defined in: [src/accessibility/pdfUaValidator.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L57)

The structure element related to the error, if any.

***

### message

> `readonly` **message**: `string`

Defined in: [src/accessibility/pdfUaValidator.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L53)

Human-readable description of the violation.

***

### pageIndex?

> `readonly` `optional` **pageIndex?**: `number`

Defined in: [src/accessibility/pdfUaValidator.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L59)

Zero-based page index, if the issue is page-specific.
