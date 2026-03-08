[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractIccProfile

# Function: extractIccProfile()

> **extractIccProfile**(`stream`, `registry`): [`IccProfile`](../interfaces/IccProfile.md) \| `undefined`

Defined in: [src/assets/image/iccProfile.ts:188](https://github.com/ABCrimson/modern-pdf-lib/blob/5f326ba39cc414c1559c669879130eaa00d3e49e/src/assets/image/iccProfile.ts#L188)

Extract the ICC color profile from a PDF image XObject's `/ColorSpace`.

Checks whether the image's `/ColorSpace` entry is an ICCBased array
(i.e. `[/ICCBased <stream ref>]`), and if so, extracts the raw ICC
profile bytes and metadata from the referenced stream.

## Parameters

### stream

[`PdfStream`](../classes/PdfStream.md)

The `PdfStream` for the image XObject.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The document's `PdfObjectRegistry` for resolving
                  indirect references.

## Returns

[`IccProfile`](../interfaces/IccProfile.md) \| `undefined`

An `IccProfile` if the image uses an ICCBased color space,
         or `undefined` if no ICC profile is attached.

## Example

```ts
import { extractIccProfile, extractImages, loadPdf } from 'modern-pdf-lib';

const doc = await loadPdf(pdfBytes);
const images = extractImages(doc);

for (const img of images) {
  const profile = extractIccProfile(img.stream, doc.getRegistry());
  if (profile) {
    console.log(`ICC: ${profile.colorSpace}, ${profile.components} channels`);
    console.log(`Description: ${profile.description ?? 'none'}`);
  }
}
```
