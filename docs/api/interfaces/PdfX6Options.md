[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfX6Options

# Interface: PdfX6Options

Defined in: src/compliance/pdfX6.ts:40

Options describing the PDF/X-6 output intent and conformance.

## Properties

### outputCondition?

> `readonly` `optional` **outputCondition?**: `string`

Defined in: src/compliance/pdfX6.ts:49

Human-readable description of the intended printing condition.

***

### outputConditionIdentifier

> `readonly` **outputConditionIdentifier**: `string`

Defined in: src/compliance/pdfX6.ts:47

Output condition identifier — a registered name (e.g. a registry
reference such as `'FOGRA51'`) or `'Custom'` for an embedded profile.

***

### registryName?

> `readonly` `optional` **registryName?**: `string`

Defined in: src/compliance/pdfX6.ts:51

Name of the registry the identifier belongs to (e.g. a URL).

***

### variant?

> `readonly` `optional` **variant?**: [`PdfX6Variant`](../type-aliases/PdfX6Variant.md)

Defined in: src/compliance/pdfX6.ts:42

Conformance variant. Defaults to `'PDF/X-6'`.
