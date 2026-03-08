[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DiffEntry

# Interface: DiffEntry

Defined in: [src/signature/documentDiff.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/documentDiff.ts#L24)

A single difference found between signed and current content.

## Properties

### description

> **description**: `string`

Defined in: [src/signature/documentDiff.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/documentDiff.ts#L38)

Human-readable description of the change.

***

### fieldName?

> `optional` **fieldName**: `string`

Defined in: [src/signature/documentDiff.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/documentDiff.ts#L36)

Form field name (for form field changes).

***

### pageIndex?

> `optional` **pageIndex**: `number`

Defined in: [src/signature/documentDiff.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/documentDiff.ts#L34)

Zero-based page index (for page-related changes).

***

### type

> **type**: `"page_added"` \| `"page_removed"` \| `"page_modified"` \| `"form_field_changed"` \| `"annotation_changed"` \| `"metadata_changed"`

Defined in: [src/signature/documentDiff.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/documentDiff.ts#L26)

The category of change detected.
