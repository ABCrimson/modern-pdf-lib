[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / splitPdf

# Function: splitPdf()

> **splitPdf**(`document`, `ranges`): `Promise`\<[`PdfDocument`](../classes/PdfDocument.md)[]\>

Defined in: [src/core/documentMerge.ts:455](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/core/documentMerge.ts#L455)

Split a PDF document into multiple documents by page ranges.

Each range produces a new PdfDocument containing only the pages
in that range. Pages can appear in multiple ranges (they are
independently copied).

## Parameters

### document

[`PdfDocument`](../classes/PdfDocument.md)

The source document to split.

### ranges

[`PageRange`](../type-aliases/PageRange.md)[]

Array of `[start, end]` ranges (zero-based, inclusive).

## Returns

`Promise`\<[`PdfDocument`](../classes/PdfDocument.md)[]\>

Array of new PdfDocument objects, one per range.

## Example

```ts
import { PdfDocument, splitPdf } from 'modern-pdf-lib';

const doc = await PdfDocument.load(bytes);
// Split into first 3 pages and remaining pages
const [part1, part2] = await splitPdf(doc, [[0, 2], [3, doc.getPageCount() - 1]]);
```
