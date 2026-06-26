[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ModificationReport

# Interface: ModificationReport

Defined in: [src/signature/modificationDetector.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/modificationDetector.ts#L49)

Report of modifications detected in a certified document.

## Properties

### certificationLevel?

> `optional` **certificationLevel?**: [`MdpPermission`](../enumerations/MdpPermission.md)

Defined in: [src/signature/modificationDetector.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/modificationDetector.ts#L51)

The certification level, if any.

***

### isCompliant

> **isCompliant**: `boolean`

Defined in: [src/signature/modificationDetector.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/modificationDetector.ts#L53)

Whether the modifications comply with the certification level.

***

### violations

> **violations**: [`ModificationViolation`](ModificationViolation.md)[]

Defined in: [src/signature/modificationDetector.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/modificationDetector.ts#L55)

List of detected violations.
