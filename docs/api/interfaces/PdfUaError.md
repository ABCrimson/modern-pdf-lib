[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfUaError

# Interface: PdfUaError

Defined in: [src/accessibility/pdfUaValidator.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L49)

A single PDF/UA validation error — a must-fix violation.

## Properties

### clause?

```ts
readonly optional clause?: string;
```

Defined in: [src/accessibility/pdfUaValidator.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L55)

The ISO 14289-1 clause reference, if applicable.

***

### code

```ts
readonly code: string;
```

Defined in: [src/accessibility/pdfUaValidator.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L51)

Machine-readable error code (e.g. `"UA-STRUCT-001"`).

***

### element?

```ts
readonly optional element?: PdfStructureElement;
```

Defined in: [src/accessibility/pdfUaValidator.ts:57](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L57)

The structure element related to the error, if any.

***

### message

```ts
readonly message: string;
```

Defined in: [src/accessibility/pdfUaValidator.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L53)

Human-readable description of the violation.

***

### pageIndex?

```ts
readonly optional pageIndex?: number;
```

Defined in: [src/accessibility/pdfUaValidator.ts:59](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L59)

Zero-based page index, if the issue is page-specific.
