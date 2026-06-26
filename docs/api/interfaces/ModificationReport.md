[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / ModificationReport

# Interface: ModificationReport

Defined in: [src/signature/modificationDetector.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L49)

Report of modifications detected in a certified document.

## Properties

### certificationLevel?

```ts
optional certificationLevel?: MdpPermission;
```

Defined in: [src/signature/modificationDetector.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L51)

The certification level, if any.

***

### isCompliant

```ts
isCompliant: boolean;
```

Defined in: [src/signature/modificationDetector.ts:53](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L53)

Whether the modifications comply with the certification level.

***

### violations

```ts
violations: ModificationViolation[];
```

Defined in: [src/signature/modificationDetector.ts:55](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/modificationDetector.ts#L55)

List of detected violations.
