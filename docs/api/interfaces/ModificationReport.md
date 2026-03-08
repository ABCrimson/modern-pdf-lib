[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ModificationReport

# Interface: ModificationReport

Defined in: [src/signature/modificationDetector.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L49)

Report of modifications detected in a certified document.

## Properties

### certificationLevel?

> `optional` **certificationLevel**: [`MdpPermission`](../enumerations/MdpPermission.md)

Defined in: [src/signature/modificationDetector.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L51)

The certification level, if any.

***

### isCompliant

> **isCompliant**: `boolean`

Defined in: [src/signature/modificationDetector.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L53)

Whether the modifications comply with the certification level.

***

### violations

> **violations**: [`ModificationViolation`](ModificationViolation.md)[]

Defined in: [src/signature/modificationDetector.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/modificationDetector.ts#L55)

List of detected violations.
