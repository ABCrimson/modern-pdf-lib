[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / gtsPdfVtVersion

# Function: gtsPdfVtVersion()

```ts
function gtsPdfVtVersion(conformance?): string;
```

Defined in: [src/compliance/pdfVT.ts:146](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfVT.ts#L146)

Map a [PdfVtConformance](../type-aliases/PdfVtConformance.md) level to its `GTS_PDFVTVersion` string, the
value placed in the document's XMP / output-intent VT version field.

## Parameters

### conformance?

[`PdfVtConformance`](../type-aliases/PdfVtConformance.md) = `'PDF/VT-1'`

The conformance level (defaults to `PDF/VT-1`).

## Returns

`string`

The `GTS_PDFVTVersion` string (e.g. `PDF/VT-1`).
