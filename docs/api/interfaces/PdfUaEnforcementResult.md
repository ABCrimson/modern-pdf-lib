[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaEnforcementResult

# Interface: PdfUaEnforcementResult

Defined in: src/accessibility/pdfUaValidator.ts:90

Result of the [enforcePdfUa](../functions/enforcePdfUa.md) auto-fix pass.

## Properties

### fixed

> `readonly` **fixed**: `string`[]

Defined in: src/accessibility/pdfUaValidator.ts:92

Actions that were successfully applied.

***

### unfixable

> `readonly` **unfixable**: [`PdfUaError`](PdfUaError.md)[]

Defined in: src/accessibility/pdfUaValidator.ts:94

Issues that could not be auto-fixed and require manual attention.
