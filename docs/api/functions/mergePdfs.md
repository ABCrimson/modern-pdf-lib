[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / mergePdfs

# Function: mergePdfs()

> **mergePdfs**(`documents`): `Promise`\<[`PdfDocument`](../classes/PdfDocument.md)\>

Defined in: [src/core/documentMerge.ts:418](https://github.com/ABCrimson/modern-pdf-lib/blob/6d920621b7c9811412316f53a974cac86961b992/src/core/documentMerge.ts#L418)

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
