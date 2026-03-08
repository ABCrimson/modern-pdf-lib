[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractImages

# Function: extractImages()

> **extractImages**(`doc`): [`ImageInfo`](../interfaces/ImageInfo.md)[]

Defined in: [src/assets/image/imageExtract.ts:169](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/assets/image/imageExtract.ts#L169)

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
