[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / mergePdfs

# Function: mergePdfs()

```ts
function mergePdfs(documents): Promise<PdfDocument>;
```

Defined in: [src/core/documentMerge.ts:382](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/core/documentMerge.ts#L382)

Merge multiple PDF documents into a single document.

Pages from each source document are appended in order. Resources
are deduplicated: if two source documents contain the same font file
(byte-identical), only one copy is kept in the merged output.

## Parameters

### documents

[`PdfDocument`](../classes/PdfDocument.md)[]

Array of PdfDocument objects to merge.

## Returns

`Promise`\&lt;[`PdfDocument`](../classes/PdfDocument.md)\&gt;

A new PdfDocument containing all pages.

## Example

```ts
import { PdfDocument, mergePdfs } from 'modern-pdf-lib';

const doc1 = await PdfDocument.load(bytes1);
const doc2 = await PdfDocument.load(bytes2);
const merged = await mergePdfs([doc1, doc2]);
const mergedBytes = await merged.save();
```
