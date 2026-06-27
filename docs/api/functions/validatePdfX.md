[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validatePdfX

# Function: validatePdfX()

```ts
function validatePdfX(pdfBytes, level): PdfXValidationResult;
```

Defined in: [src/compliance/pdfxCompliance.ts:186](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/compliance/pdfxCompliance.ts#L186)

Validate a PDF against a specific PDF/X conformance level.

Performs structural checks on the raw PDF bytes for:
- Output intent presence and subtype
- /Trapped key in Info dictionary
- Transparency restrictions (X-1a, X-3)
- Color space restrictions (X-1a: CMYK/Gray only)
- Font embedding
- No encryption
- TrimBox or BleedBox on every page
- No JavaScript or multimedia
- Page box nesting (MediaBox &gt;= BleedBox &gt;= TrimBox &gt;= ArtBox)
- PDF version requirements (X-4 requires 1.6+)

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### level

`PdfXLevel`

The target PDF/X conformance level.

## Returns

`PdfXValidationResult`

A validation result with errors and warnings.
