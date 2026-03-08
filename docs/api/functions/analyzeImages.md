[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / analyzeImages

# Function: analyzeImages()

> **analyzeImages**(`doc`, `options?`): [`AnalysisReport`](../interfaces/AnalysisReport.md)

Defined in: [src/assets/image/compressionAnalysis.ts:199](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/assets/image/compressionAnalysis.ts#L199)

Analyze all images in a PDF and report potential savings without
modifying the document.

For each image XObject with `bitsPerComponent === 8` and 1–4 channels,
the function estimates the JPEG-encoded size — using the WASM encoder
when available, or a heuristic fallback otherwise.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

A parsed `PdfDocument`.

### options?

[`AnalyzeImagesOptions`](../interfaces/AnalyzeImagesOptions.md)

Optional quality and maxDpi settings.

## Returns

[`AnalysisReport`](../interfaces/AnalysisReport.md)

An `AnalysisReport` with per-image and aggregate statistics.

## Example

```ts
import { loadPdf, analyzeImages } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const report = analyzeImages(doc, { quality: 75, maxDpi: 150 });

console.log(`Total savings: ${report.totalSavingsPercent.toFixed(1)}%`);
for (const img of report.images) {
  console.log(`  ${img.name}: ${img.recommendation} (${img.savingsPercent.toFixed(1)}%)`);
}
```
