[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyHeaderFooterToPage

# Function: applyHeaderFooterToPage()

> **applyHeaderFooterToPage**(`page`, `options`, `pageNumber`, `totalPages`, `title?`): `void`

Defined in: [src/layout/headerFooter.ts:162](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/layout/headerFooter.ts#L162)

Apply header/footer to a single page.

## Parameters

### page

[`PdfPage`](../classes/PdfPage.md)

The page to draw on.

### options

[`HeaderFooterOptions`](../interfaces/HeaderFooterOptions.md)

Header/footer configuration.

### pageNumber

`number`

1-based page number.

### totalPages

`number`

Total page count in the document.

### title?

`string`

Optional document title for `{title}` replacement.

## Returns

`void`
