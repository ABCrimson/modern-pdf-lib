[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildBoxDict

# Function: buildBoxDict()

```ts
function buildBoxDict(box): PdfDict;
```

Defined in: [src/compliance/pdfX6.ts:198](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L198)

Build the page-box entries (`/MediaBox`, `/TrimBox`, `/BleedBox`) as a
dictionary fragment that can be merged into a page dictionary.

## Parameters

### box

[`BoxGeometry`](../interfaces/BoxGeometry.md)

The geometry to encode.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A dictionary holding the box arrays.
