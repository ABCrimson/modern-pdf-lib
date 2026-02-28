[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / formatPdfDate

# Function: formatPdfDate()

> **formatPdfDate**(`date`): `string`

Defined in: [src/core/pdfCatalog.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pdfCatalog.ts#L36)

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
