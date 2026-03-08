[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / flattenField

# Function: flattenField()

> **flattenField**(`form`, `fieldName`, `options?`): [`FlattenFormResult`](../interfaces/FlattenFormResult.md)

Defined in: src/form/formFlatten.ts:282

Flatten a SINGLE field by name.

Locates the field in the form, merges its appearance into the page
content, removes the widget annotation, and removes the field from
the AcroForm's /Fields array. Other fields remain interactive.

## Parameters

### form

[`PdfForm`](../classes/PdfForm.md)

The document's PdfForm.

### fieldName

`string`

The name of the field to flatten (partial or fully-qualified).

### options?

[`FlattenOptions`](../interfaces/FlattenOptions.md) = `{}`

Optional flatten options.

## Returns

[`FlattenFormResult`](../interfaces/FlattenFormResult.md)

An object describing the flatten operations performed.

## Throws

If the field is not found.
