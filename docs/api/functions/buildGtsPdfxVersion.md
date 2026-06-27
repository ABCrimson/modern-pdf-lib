[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildGtsPdfxVersion

# Function: buildGtsPdfxVersion()

```ts
function buildGtsPdfxVersion(variant?): string;
```

Defined in: [src/compliance/pdfX6.ts:105](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfX6.ts#L105)

Return the `GTS_PDFXVersion` Info-dictionary value for a variant.

## Parameters

### variant?

[`PdfX6Variant`](../type-aliases/PdfX6Variant.md)

The conformance variant. Defaults to `'PDF/X-6'`.

## Returns

`string`

The string to store under the Info-dict `/GTS_PDFXVersion` key.
