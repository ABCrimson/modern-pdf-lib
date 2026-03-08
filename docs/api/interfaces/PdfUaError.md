[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaError

# Interface: PdfUaError

Defined in: src/accessibility/pdfUaValidator.ts:46

A single PDF/UA validation error — a must-fix violation.

## Properties

### clause?

> `readonly` `optional` **clause**: `string`

Defined in: src/accessibility/pdfUaValidator.ts:52

The ISO 14289-1 clause reference, if applicable.

***

### code

> `readonly` **code**: `string`

Defined in: src/accessibility/pdfUaValidator.ts:48

Machine-readable error code (e.g. `"UA-STRUCT-001"`).

***

### element?

> `readonly` `optional` **element**: [`PdfStructureElement`](../classes/PdfStructureElement.md)

Defined in: src/accessibility/pdfUaValidator.ts:54

The structure element related to the error, if any.

***

### message

> `readonly` **message**: `string`

Defined in: src/accessibility/pdfUaValidator.ts:50

Human-readable description of the violation.

***

### pageIndex?

> `readonly` `optional` **pageIndex**: `number`

Defined in: src/accessibility/pdfUaValidator.ts:56

Zero-based page index, if the issue is page-specific.
