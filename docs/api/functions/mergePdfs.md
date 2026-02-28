[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / mergePdfs

# Function: mergePdfs()

> **mergePdfs**(`documents`): `Promise`\<[`PdfDocument`](../classes/PdfDocument.md)\>

Defined in: [src/core/documentMerge.ts:383](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/core/documentMerge.ts#L383)

Merge multiple PDF documents into a single document.

Pages from each source document are appended in order. Resources
are deduplicated: if two source documents contain the same font file
(byte-identical), only one copy is kept in the merged output.

## Parameters

### documents

[`PdfDocument`](../classes/PdfDocument.md)[]

Array of PdfDocument objects to merge.

## Returns

`Promise`\<[`PdfDocument`](../classes/PdfDocument.md)\>

A new PdfDocument containing all pages.

## Example

```ts
import { PdfDocument, mergePdfs } from 'modern-pdf-lib';

const doc1 = await PdfDocument.load(bytes1);
const doc2 = await PdfDocument.load(bytes2);
const merged = await mergePdfs([doc1, doc2]);
const mergedBytes = await merged.save();
```
