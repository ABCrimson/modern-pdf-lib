[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateFieldValue

# Function: validateFieldValue()

```ts
function validateFieldValue(
   field, 
   value, 
   script): ValidationResult;
```

Defined in: [src/form/fieldValidation.ts:195](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/form/fieldValidation.ts#L195)

Validate a field's value using a validation script string.

The script is parsed to determine the validation type. If the script
matches a known Acrobat validation pattern (email, phone, range, etc.),
the corresponding built-in validation is applied. Otherwise, the value
is considered valid (custom scripts are not executed).

## Parameters

### field

[`PdfField`](../classes/PdfField.md)

The PdfField being validated.

### value

`string`

The string value to validate.

### script

`string`

The validation script (Acrobat JavaScript).

## Returns

`ValidationResult`

A ValidationResult indicating whether the value is valid.
