[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / resolveFieldReference

# Function: resolveFieldReference()

```ts
function resolveFieldReference(form, fieldName): PdfField | null;
```

Defined in: [src/form/fieldReferences.ts:83](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldReferences.ts#L83)

Resolve a field name to a PdfField instance.

Handles hierarchical names (e.g., `"form.section.field"`) by looking
up the fully-qualified name in the form's field index.

## Parameters

### form

[`PdfForm`](../classes/PdfForm.md)

The PdfForm to search.

### fieldName

`string`

The field name (partial or fully-qualified).

## Returns

[`PdfField`](../classes/PdfField.md) \| `null`

The PdfField if found, or `null`.
