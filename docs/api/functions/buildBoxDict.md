[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildBoxDict

# Function: buildBoxDict()

```ts
function buildBoxDict(box): PdfDict;
```

Defined in: [src/compliance/pdfX6.ts:198](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfX6.ts#L198)

Build the page-box entries (`/MediaBox`, `/TrimBox`, `/BleedBox`) as a
dictionary fragment that can be merged into a page dictionary.

## Parameters

### box

[`BoxGeometry`](../interfaces/BoxGeometry.md)

The geometry to encode.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A dictionary holding the box arrays.
