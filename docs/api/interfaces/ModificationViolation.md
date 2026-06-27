[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ModificationViolation

# Interface: ModificationViolation

Defined in: [src/signature/modificationDetector.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/modificationDetector.ts#L37)

A single modification violation detected in the document.

## Properties

### affectedSignatureIndex

```ts
affectedSignatureIndex: number;
```

Defined in: [src/signature/modificationDetector.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/modificationDetector.ts#L43)

Index of the signature whose coverage was violated.

***

### description

```ts
description: string;
```

Defined in: [src/signature/modificationDetector.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/modificationDetector.ts#L41)

Human-readable description of the violation.

***

### type

```ts
type: ModificationViolationType;
```

Defined in: [src/signature/modificationDetector.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/modificationDetector.ts#L39)

The type of modification detected.
