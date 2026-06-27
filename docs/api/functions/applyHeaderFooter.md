[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / applyHeaderFooter

# Function: applyHeaderFooter()

```ts
function applyHeaderFooter(doc, options): void;
```

Defined in: [src/layout/headerFooter.ts:277](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/layout/headerFooter.ts#L277)

Apply headers and footers to all pages in a document.

Respects `skipFirstPage` and `pageRange` options.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PDF document.

### options

[`HeaderFooterOptions`](../interfaces/HeaderFooterOptions.md)

Header/footer configuration.

## Returns

`void`
