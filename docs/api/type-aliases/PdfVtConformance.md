[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / PdfVtConformance

# Type Alias: PdfVtConformance

```ts
type PdfVtConformance = "PDF/VT-1" | "PDF/VT-2" | "PDF/VT-3";
```

Defined in: [src/compliance/pdfVT.ts:42](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfVT.ts#L42)

PDF/VT conformance level (ISO 16612-2).

- `PDF/VT-1` — self-contained single file (built on PDF/X-4).
- `PDF/VT-2` — may reference external content via PDF/X-5 / external graphics.
- `PDF/VT-3` — streamed variant (PDF/VT-1s) for incremental production.
