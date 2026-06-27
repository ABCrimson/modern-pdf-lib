[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / DiffEntry

# Interface: DiffEntry

Defined in: [src/signature/documentDiff.ts:24](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L24)

A single difference found between signed and current content.

## Properties

### description

```ts
description: string;
```

Defined in: [src/signature/documentDiff.ts:38](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L38)

Human-readable description of the change.

***

### fieldName?

```ts
optional fieldName?: string;
```

Defined in: [src/signature/documentDiff.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L36)

Form field name (for form field changes).

***

### pageIndex?

```ts
optional pageIndex?: number;
```

Defined in: [src/signature/documentDiff.ts:34](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L34)

Zero-based page index (for page-related changes).

***

### type

```ts
type: 
  | "page_added"
  | "page_removed"
  | "page_modified"
  | "form_field_changed"
  | "annotation_changed"
  | "metadata_changed";
```

Defined in: [src/signature/documentDiff.ts:26](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/documentDiff.ts#L26)

The category of change detected.
