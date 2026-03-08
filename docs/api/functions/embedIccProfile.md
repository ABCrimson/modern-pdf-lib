[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / embedIccProfile

# Function: embedIccProfile()

> **embedIccProfile**(`profile`, `registry`): [`PdfRef`](../classes/PdfRef.md)

Defined in: [src/assets/image/iccProfile.ts:275](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/assets/image/iccProfile.ts#L275)

Embed an ICC color profile into the PDF object registry and return
a reference that can be used as a `/ColorSpace` entry.

Creates a new `PdfStream` for the ICC profile data with the required
`/N` (number of components) entry, registers it, and returns a
`PdfRef` to the stream. The caller should then set the image's
`/ColorSpace` to `[/ICCBased <returned ref>]`.

## Parameters

### profile

[`IccProfile`](../interfaces/IccProfile.md)

The `IccProfile` to embed.

### registry

[`PdfObjectRegistry`](../classes/PdfObjectRegistry.md)

The document's `PdfObjectRegistry`.

## Returns

[`PdfRef`](../classes/PdfRef.md)

A `PdfRef` pointing to the newly created ICC profile stream.

## Example

```ts
import { embedIccProfile, extractIccProfile } from 'modern-pdf-lib';

const profile = extractIccProfile(imageStream, registry);
if (profile) {
  const profileRef = embedIccProfile(profile, registry);
  const colorSpace = PdfArray.of([PdfName.of('/ICCBased'), profileRef]);
  imageStream.dict.set('/ColorSpace', colorSpace);
}
```
