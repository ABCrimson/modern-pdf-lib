[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / flattenField

# Function: flattenField()

```ts
function flattenField(
   form, 
   fieldName, 
   options?): FlattenFormResult;
```

Defined in: [src/form/formFlatten.ts:1010](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/formFlatten.ts#L1010)

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
