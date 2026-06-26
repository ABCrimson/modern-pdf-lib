[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractImages

# Function: extractImages()

```ts
function extractImages(doc): ImageInfo[];
```

Defined in: [src/assets/image/imageExtract.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/assets/image/imageExtract.ts#L169)

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
