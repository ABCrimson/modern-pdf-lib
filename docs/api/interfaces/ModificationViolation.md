[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ModificationViolation

# Interface: ModificationViolation

Defined in: [src/signature/modificationDetector.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L37)

A single modification violation detected in the document.

## Properties

### affectedSignatureIndex

> **affectedSignatureIndex**: `number`

Defined in: [src/signature/modificationDetector.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L43)

Index of the signature whose coverage was violated.

***

### description

> **description**: `string`

Defined in: [src/signature/modificationDetector.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L41)

Human-readable description of the violation.

***

### type

> **type**: [`ModificationViolationType`](../type-aliases/ModificationViolationType.md)

Defined in: [src/signature/modificationDetector.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L39)

The type of modification detected.
