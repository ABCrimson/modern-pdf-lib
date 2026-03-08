[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ModificationViolation

# Interface: ModificationViolation

Defined in: [src/signature/modificationDetector.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/modificationDetector.ts#L37)

A single modification violation detected in the document.

## Properties

### affectedSignatureIndex

> **affectedSignatureIndex**: `number`

Defined in: [src/signature/modificationDetector.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/modificationDetector.ts#L43)

Index of the signature whose coverage was violated.

***

### description

> **description**: `string`

Defined in: [src/signature/modificationDetector.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/modificationDetector.ts#L41)

Human-readable description of the violation.

***

### type

> **type**: [`ModificationViolationType`](../type-aliases/ModificationViolationType.md)

Defined in: [src/signature/modificationDetector.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/modificationDetector.ts#L39)

The type of modification detected.
