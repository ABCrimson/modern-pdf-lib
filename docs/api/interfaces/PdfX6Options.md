[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfX6Options

# Interface: PdfX6Options

Defined in: [src/compliance/pdfX6.ts:40](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L40)

Options describing the PDF/X-6 output intent and conformance.

## Properties

### outputCondition?

```ts
readonly optional outputCondition?: string;
```

Defined in: [src/compliance/pdfX6.ts:49](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L49)

Human-readable description of the intended printing condition.

***

### outputConditionIdentifier

```ts
readonly outputConditionIdentifier: string;
```

Defined in: [src/compliance/pdfX6.ts:47](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L47)

Output condition identifier — a registered name (e.g. a registry
reference such as `'FOGRA51'`) or `'Custom'` for an embedded profile.

***

### registryName?

```ts
readonly optional registryName?: string;
```

Defined in: [src/compliance/pdfX6.ts:51](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L51)

Name of the registry the identifier belongs to (e.g. a URL).

***

### variant?

```ts
readonly optional variant?: PdfX6Variant;
```

Defined in: [src/compliance/pdfX6.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L42)

Conformance variant. Defaults to `'PDF/X-6'`.
