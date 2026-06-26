[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildBoxDict

# Function: buildBoxDict()

> **buildBoxDict**(`box`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/compliance/pdfX6.ts:198

Build the page-box entries (`/MediaBox`, `/TrimBox`, `/BleedBox`) as a
dictionary fragment that can be merged into a page dictionary.

## Parameters

### box

[`BoxGeometry`](../interfaces/BoxGeometry.md)

The geometry to encode.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A dictionary holding the box arrays.
