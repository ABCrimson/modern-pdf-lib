[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / splitPdf

# Function: splitPdf()

> **splitPdf**(`document`, `ranges`): `Promise`\<[`PdfDocument`](../classes/PdfDocument.md)[]\>

Defined in: [src/core/documentMerge.ts:490](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/core/documentMerge.ts#L490)

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
