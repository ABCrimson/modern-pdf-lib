[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyHeaderFooterToPage

# Function: applyHeaderFooterToPage()

```ts
function applyHeaderFooterToPage(
   page, 
   options, 
   pageNumber, 
   totalPages, 
   title?): void;
```

Defined in: [src/layout/headerFooter.ts:162](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/layout/headerFooter.ts#L162)

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
