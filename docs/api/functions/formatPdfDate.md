[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / formatPdfDate

# Function: formatPdfDate()

> **formatPdfDate**(`date`): `string`

Defined in: [src/core/pdfCatalog.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/pdfCatalog.ts#L36)

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
