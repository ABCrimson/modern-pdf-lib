[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / flattenFields

# Function: flattenFields()

```ts
function flattenFields(
   form, 
   fieldNames, 
   options?): FlattenFormResult;
```

Defined in: [src/form/formFlatten.ts:1031](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1031)

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
