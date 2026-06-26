[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaEnforcementResult

# Interface: PdfUaEnforcementResult

Defined in: [src/accessibility/pdfUaValidator.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L93)

Result of the [enforcePdfUa](../functions/enforcePdfUa.md) auto-fix pass.

## Properties

### fixed

> `readonly` **fixed**: `string`[]

Defined in: [src/accessibility/pdfUaValidator.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L95)

Actions that were successfully applied.

***

### unfixable

> `readonly` **unfixable**: [`PdfUaError`](PdfUaError.md)[]

Defined in: [src/accessibility/pdfUaValidator.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/accessibility/pdfUaValidator.ts#L97)

Issues that could not be auto-fixed and require manual attention.
