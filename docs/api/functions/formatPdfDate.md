[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / formatPdfDate

# Function: formatPdfDate()

> **formatPdfDate**(`date`): `string`

Defined in: [src/core/pdfCatalog.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/core/pdfCatalog.ts#L36)

Format a `Date` as a PDF date string.

PDF dates follow the form: `D:YYYYMMDDHHmmSSOHH'mm`

- `O` is the relationship to UT: `+`, `-`, or `Z`.
- The trailing `HH'mm` is the UT offset.

## Parameters

### date

`Date`

A JavaScript Date object.

## Returns

`string`

A PDF date string wrapped in parentheses.
