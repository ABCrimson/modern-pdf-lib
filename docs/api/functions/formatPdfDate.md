[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / formatPdfDate

# Function: formatPdfDate()

```ts
function formatPdfDate(date): string;
```

Defined in: [src/core/pdfCatalog.ts:36](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/pdfCatalog.ts#L36)

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
