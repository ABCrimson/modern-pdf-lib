[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / formatPdfDate

# Function: formatPdfDate()

> **formatPdfDate**(`date`): `string`

Defined in: [src/core/pdfCatalog.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/pdfCatalog.ts#L36)

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
