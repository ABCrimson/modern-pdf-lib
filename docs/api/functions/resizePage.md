[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / resizePage

# Function: resizePage()

> **resizePage**(`doc`, `index`, `size`): `void`

Defined in: [src/core/pageManipulation.ts:324](https://github.com/ABCrimson/modern-pdf-lib/blob/6ce8fea7ba62114c9bdeda1f601086d76e1fe5d2/src/core/pageManipulation.ts#L324)

Resize a page by setting its media box.

Note: This changes the page dimensions but does not scale existing
content. Content that was drawn at coordinates beyond the new
dimensions may be clipped.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### index

`number`

Zero-based page index.

### size

[`PageSize`](../type-aliases/PageSize.md)

New page size.

## Returns

`void`
