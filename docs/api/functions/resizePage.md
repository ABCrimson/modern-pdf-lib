[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / resizePage

# Function: resizePage()

> **resizePage**(`doc`, `index`, `size`): `void`

Defined in: [src/core/pageManipulation.ts:324](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/core/pageManipulation.ts#L324)

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
