[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ModificationViolation

# Interface: ModificationViolation

Defined in: [src/signature/modificationDetector.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L37)

A single modification violation detected in the document.

## Properties

### affectedSignatureIndex

```ts
affectedSignatureIndex: number;
```

Defined in: [src/signature/modificationDetector.ts:43](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L43)

Index of the signature whose coverage was violated.

***

### description

```ts
description: string;
```

Defined in: [src/signature/modificationDetector.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L41)

Human-readable description of the violation.

***

### type

```ts
type: ModificationViolationType;
```

Defined in: [src/signature/modificationDetector.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L39)

The type of modification detected.
