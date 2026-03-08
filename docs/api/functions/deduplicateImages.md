[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / deduplicateImages

# Function: deduplicateImages()

> **deduplicateImages**(`doc`): [`DeduplicationReport`](../interfaces/DeduplicationReport.md)

Defined in: [src/assets/image/deduplicateImages.ts:110](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/deduplicateImages.ts#L110)

Deduplicate identical images in a PDF document.

Scans all image XObjects, hashes their compressed stream data (plus
dimensions and filter), and replaces duplicate references in page
resource dictionaries with the canonical (first-seen) copy.

This operation modifies the document in-place. Duplicate streams
are not removed from the object registry (they become unreferenced
and will be omitted on save if the writer supports garbage collection).

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

A parsed `PdfDocument` (from `loadPdf()`).

## Returns

[`DeduplicationReport`](../interfaces/DeduplicationReport.md)

A report summarizing deduplication results.

## Example

```ts
import { loadPdf, deduplicateImages } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const report = await deduplicateImages(doc);

console.log(`Removed ${report.duplicatesRemoved} duplicate images`);
console.log(`Saved ~${(report.bytesSaved / 1024).toFixed(0)} KB`);

const optimizedBytes = await doc.save();
```
