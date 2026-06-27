[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getFieldValue

# Function: getFieldValue()

```ts
function getFieldValue(form, fieldName): string | null;
```

Defined in: [src/form/fieldReferences.ts:99](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldReferences.ts#L99)

Get a field's value by name.

Convenience function that resolves the field and returns its string value.

## Parameters

### form

[`PdfForm`](../classes/PdfForm.md)

The PdfForm to search.

### fieldName

`string`

The field name.

## Returns

`string` \| `null`

The field's value as a string, or `null` if the field is not found.
