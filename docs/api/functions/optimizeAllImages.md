[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / optimizeAllImages

# Function: optimizeAllImages()

> **optimizeAllImages**(`doc`, `options?`): `Promise`\<[`OptimizationReport`](../interfaces/OptimizationReport.md)\>

Defined in: [src/assets/image/batchOptimize.ts:249](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/batchOptimize.ts#L249)

Optimize all images in a PDF document by recompressing them as JPEG.

Walks every image XObject in the document, decodes its pixel data,
recompresses it as JPEG using the WASM encoder (if available), and
replaces the stream data in-place when the result is smaller.

**Requires the JPEG WASM module to be initialized** via
`initJpegWasm()` or `initWasm({ jpeg: true })`.  Without it,
no images will be optimized (all will be skipped).

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

A parsed `PdfDocument` (from `loadPdf()`).

### options?

[`BatchOptimizeOptions`](../interfaces/BatchOptimizeOptions.md) = `{}`

Optimization settings.

## Returns

`Promise`\<[`OptimizationReport`](../interfaces/OptimizationReport.md)\>

A report summarizing the optimization results.

## Example

```ts
import { loadPdf, initWasm, optimizeAllImages } from 'modern-pdf-lib';

await initWasm({ jpeg: true });

const doc = await loadPdf(pdfBytes);
const report = await optimizeAllImages(doc);

console.log(`Optimized ${report.optimizedImages} of ${report.totalImages} images`);
console.log(`Savings: ${report.savings.toFixed(1)}%`);

const optimizedBytes = await doc.save();
```
