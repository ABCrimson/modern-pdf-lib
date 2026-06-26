[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / splitPdf

# Function: splitPdf()

```ts
function splitPdf(document, ranges): Promise<PdfDocument[]>;
```

Defined in: [src/core/documentMerge.ts:454](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/core/documentMerge.ts#L454)

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

`Promise`\&lt;[`PdfDocument`](../classes/PdfDocument.md)[]\&gt;

Array of new PdfDocument objects, one per range.

## Example

```ts
import { PdfDocument, splitPdf } from 'modern-pdf-lib';

const doc = await PdfDocument.load(bytes);
// Split into first 3 pages and remaining pages
const [part1, part2] = await splitPdf(doc, [[0, 2], [3, doc.getPageCount() - 1]]);
```
