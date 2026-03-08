[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaWarning

# Interface: PdfUaWarning

Defined in: src/accessibility/pdfUaValidator.ts:62

A single PDF/UA validation warning — a best-practice recommendation.

## Properties

### code

> `readonly` **code**: `string`

Defined in: src/accessibility/pdfUaValidator.ts:64

Machine-readable warning code (e.g. `"UA-WARN-001"`).

***

### element?

> `readonly` `optional` **element**: [`PdfStructureElement`](../classes/PdfStructureElement.md)

Defined in: src/accessibility/pdfUaValidator.ts:68

The structure element related to the warning, if any.

***

### message

> `readonly` **message**: `string`

Defined in: src/accessibility/pdfUaValidator.ts:66

Human-readable recommendation.

***

### pageIndex?

> `readonly` `optional` **pageIndex**: `number`

Defined in: src/accessibility/pdfUaValidator.ts:70

Zero-based page index, if the warning is page-specific.
