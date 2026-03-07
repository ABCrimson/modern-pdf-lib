[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / insertPage

# Function: insertPage()

> **insertPage**(`doc`, `index`, `size?`): [`PdfPage`](../classes/PdfPage.md)

Defined in: [src/core/pageManipulation.ts:146](https://github.com/ABCrimson/modern-pdf-lib/blob/6d046595d60660cf33d40ffaf2f06aafcf356d8e/src/core/pageManipulation.ts#L146)

Insert a new blank page into the document at the specified position.

All existing pages at `index` and beyond are shifted to make room.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PdfDocument to modify.

### index

`number`

Zero-based position at which to insert the page.
              Must be in the range `[0, pageCount]`.

### size?

[`PageSize`](../type-aliases/PageSize.md)

Optional page size. Defaults to A4.

## Returns

[`PdfPage`](../classes/PdfPage.md)

The newly created PdfPage.

## Example

```ts
import { createPdf, insertPage, PageSizes } from 'modern-pdf-lib';

const doc = createPdf();
doc.addPage();
const newPage = insertPage(doc, 0, PageSizes.Letter); // insert at front
```
