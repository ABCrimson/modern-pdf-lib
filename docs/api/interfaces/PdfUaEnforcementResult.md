[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaEnforcementResult

# Interface: PdfUaEnforcementResult

Defined in: [src/accessibility/pdfUaValidator.ts:93](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L93)

Result of the [enforcePdfUa](../functions/enforcePdfUa.md) auto-fix pass.

## Properties

### fixed

```ts
readonly fixed: string[];
```

Defined in: [src/accessibility/pdfUaValidator.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L95)

Actions that were successfully applied.

***

### unfixable

```ts
readonly unfixable: PdfUaError[];
```

Defined in: [src/accessibility/pdfUaValidator.ts:97](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L97)

Issues that could not be auto-fixed and require manual attention.
