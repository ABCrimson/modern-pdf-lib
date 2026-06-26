[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / loadPdf

# Function: loadPdf()

```ts
function loadPdf(data, options?): Promise<PdfDocument>;
```

Defined in: [src/parser/documentParser.ts:1624](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/parser/documentParser.ts#L1624)

Load a PDF document from raw bytes, an ArrayBuffer, or a Base64-encoded
string.

This is the primary entry point for parsing existing PDFs. It creates
a `PdfDocumentParser`, runs the full parse pipeline, and returns
a populated [PdfDocument](../classes/PdfDocument.md).

## Parameters

### data

`string` \| `ArrayBuffer` \| `Uint8Array`\&lt;`ArrayBufferLike`\&gt;

The PDF data as a `Uint8Array`, `ArrayBuffer`, or a
                Base64-encoded string.

### options?

[`LoadPdfOptions`](../interfaces/LoadPdfOptions.md)

Optional loading options.

## Returns

`Promise`\&lt;[`PdfDocument`](../classes/PdfDocument.md)\&gt;

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
