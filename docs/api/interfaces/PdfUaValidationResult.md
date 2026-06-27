[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaValidationResult

# Interface: PdfUaValidationResult

Defined in: [src/accessibility/pdfUaValidator.ts:79](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L79)

Result of a PDF/UA validation check.

## Properties

### errors

```ts
readonly errors: PdfUaError[];
```

Defined in: [src/accessibility/pdfUaValidator.ts:85](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L85)

Must-fix violations that prevent compliance.

***

### level

```ts
readonly level: "UA1";
```

Defined in: [src/accessibility/pdfUaValidator.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L83)

The PDF/UA conformance level checked against.

***

### valid

```ts
readonly valid: boolean;
```

Defined in: [src/accessibility/pdfUaValidator.ts:81](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L81)

Whether the document passes all PDF/UA requirements (no errors).

***

### warnings

```ts
readonly warnings: PdfUaWarning[];
```

Defined in: [src/accessibility/pdfUaValidator.ts:87](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L87)

Best-practice recommendations.
