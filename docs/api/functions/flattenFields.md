[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / flattenFields

# Function: flattenFields()

> **flattenFields**(`form`, `fieldNames`, `options?`): [`FlattenFormResult`](../interfaces/FlattenFormResult.md)

Defined in: src/form/formFlatten.ts:303

Flatten specific fields by name.

## Parameters

### form

[`PdfForm`](../classes/PdfForm.md)

The document's PdfForm.

### fieldNames

`string`[]

Array of field names to flatten.

### options?

[`FlattenOptions`](../interfaces/FlattenOptions.md) = `{}`

Optional flatten options.

## Returns

[`FlattenFormResult`](../interfaces/FlattenFormResult.md)

An object describing the flatten operations performed.

## Throws

If any field name is not found.
