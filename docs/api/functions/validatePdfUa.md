[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validatePdfUa

# Function: validatePdfUa()

> **validatePdfUa**(`doc`, `level?`): [`PdfUaValidationResult`](../interfaces/PdfUaValidationResult.md)

Defined in: src/accessibility/pdfUaValidator.ts:159

Validate a PDF document against PDF/UA-1 (ISO 14289-1) requirements.

Performs the following checks:
1. Structure tree presence (/StructTreeRoot, /MarkInfo)
2. Document language (/Lang)
3. Document title and /DisplayDocTitle
4. Heading hierarchy (sequential, no skips)
5. Alt text on all illustration elements (Figure, Formula, Form)
6. Table header cells (TH) with scope
7. List structure (L/LI/Lbl/LBody)
8. Reading order via structure tree
9. Font embedding (no unembedded standard 14 fonts)
10. Color contrast (AA: 4.5:1, AAA: 7:1)
11. Bookmarks for navigation
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
