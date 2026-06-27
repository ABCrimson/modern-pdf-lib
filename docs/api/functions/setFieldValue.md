[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / setFieldValue

# Function: setFieldValue()

```ts
function setFieldValue(
   form, 
   fieldName, 
   value): boolean;
```

Defined in: [src/form/fieldReferences.ts:123](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldReferences.ts#L123)

Set a field's value by name.

Convenience function that resolves the field and sets its value.

## Parameters

### form

[`PdfForm`](../classes/PdfForm.md)

The PdfForm to search.

### fieldName

`string`

The field name.

### value

`string`

The value to set.

## Returns

`boolean`

`true` if the field was found and the value was set, `false` otherwise.
