[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractImages

# Function: extractImages()

> **extractImages**(`doc`): [`ImageInfo`](../interfaces/ImageInfo.md)[]

Defined in: [src/assets/image/imageExtract.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/assets/image/imageExtract.ts#L169)

Extract all image XObjects from a PDF document.

Walks every page's `/Resources /XObject` dictionary and collects
metadata for each image XObject found.

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

A parsed `PdfDocument`.

## Returns

[`ImageInfo`](../interfaces/ImageInfo.md)[]

An array of `ImageInfo` objects, one per image XObject.

## Example

```ts
import { loadPdf, extractImages } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const images = extractImages(doc);

for (const img of images) {
  console.log(`${img.name}: ${img.width}x${img.height} ${img.colorSpace} (${img.compressedSize} bytes)`);
}
```
