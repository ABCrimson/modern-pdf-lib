[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validatePdfUa

# Function: validatePdfUa()

```ts
function validatePdfUa(doc, level?): PdfUaValidationResult;
```

Defined in: [src/accessibility/pdfUaValidator.ts:183](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/accessibility/pdfUaValidator.ts#L183)

Validate a PDF document against PDF/UA-1 (ISO 14289-1) requirements.

Performs the following checks:
1. Structure tree presence (/StructTreeRoot, /MarkInfo)
2. Document language (/Lang)
3. Document title and /DisplayDocTitle
4. Heading hierarchy (section-aware, same-parent skip detection)
5. Alt text on all illustration elements (excluding artifacts)
6. Table header cells (size-aware, layout table aware)
7. List structure (L/LI/Lbl/LBody)
8. Reading order via structure tree
9. Font embedding (excluding form-field-only fonts)
10. Color contrast (AA: 4.5:1, AAA: 7:1)
11. Bookmarks for navigation (documents &gt; 3 pages)
12. Tab order (/Tabs /S) on pages

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PDF document to validate.

### level?

`"UA1"` = `'UA1'`

The PDF/UA conformance level (default: `'UA1'`).

## Returns

[`PdfUaValidationResult`](../interfaces/PdfUaValidationResult.md)

A [PdfUaValidationResult](../interfaces/PdfUaValidationResult.md) with errors and warnings.

## Example

```ts
import { createPdf } from 'modern-pdf-lib';
import { validatePdfUa } from 'modern-pdf-lib/accessibility';

const doc = createPdf();
const result = validatePdfUa(doc);
if (!result.valid) {
  for (const err of result.errors) {
    console.error(`[${err.code}] ${err.message}`);
  }
}
```
