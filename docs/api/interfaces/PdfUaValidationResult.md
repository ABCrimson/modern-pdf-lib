[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaValidationResult

# Interface: PdfUaValidationResult

Defined in: src/accessibility/pdfUaValidator.ts:76

Result of a PDF/UA validation check.

## Properties

### errors

> `readonly` **errors**: [`PdfUaError`](PdfUaError.md)[]

Defined in: src/accessibility/pdfUaValidator.ts:82

Must-fix violations that prevent compliance.

***

### level

> `readonly` **level**: `"UA1"`

Defined in: src/accessibility/pdfUaValidator.ts:80

The PDF/UA conformance level checked against.

***

### valid

> `readonly` **valid**: `boolean`

Defined in: src/accessibility/pdfUaValidator.ts:78

Whether the document passes all PDF/UA requirements (no errors).

***

### warnings

> `readonly` **warnings**: [`PdfUaWarning`](PdfUaWarning.md)[]

Defined in: src/accessibility/pdfUaValidator.ts:84

Best-practice recommendations.
