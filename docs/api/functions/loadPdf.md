[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / loadPdf

# Function: loadPdf()

> **loadPdf**(`data`, `options?`): `Promise`\<[`PdfDocument`](../classes/PdfDocument.md)\>

Defined in: [src/parser/documentParser.ts:1628](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/parser/documentParser.ts#L1628)

Load a PDF document from raw bytes, an ArrayBuffer, or a Base64-encoded
string.

This is the primary entry point for parsing existing PDFs. It creates
a `PdfDocumentParser`, runs the full parse pipeline, and returns
a populated [PdfDocument](../classes/PdfDocument.md).

## Parameters

### data

The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
                Base64-encoded string.

`string` | `ArrayBuffer` | `Uint8Array`\<`ArrayBufferLike`\>

### options?

[`LoadPdfOptions`](../interfaces/LoadPdfOptions.md)

Optional loading options.

## Returns

`Promise`\<[`PdfDocument`](../classes/PdfDocument.md)\>

A fully parsed PdfDocument.

## Example

```ts
import { loadPdf } from 'modern-pdf-lib';

// From fetch (ArrayBuffer)
const pdfBytes = await fetch('document.pdf').then(r => r.arrayBuffer());
const doc = await loadPdf(pdfBytes);

// From a Base64 string
const doc2 = await loadPdf(base64String);
```
