[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / enforcePdfUa

# Function: enforcePdfUa()

> **enforcePdfUa**(`doc`): [`PdfUaEnforcementResult`](../interfaces/PdfUaEnforcementResult.md)

Defined in: src/accessibility/pdfUaValidator.ts:250

Auto-fix PDF/UA issues that can be corrected programmatically.

Applies the following corrections when the relevant requirement is
not already satisfied:
- Sets `/Lang` to `'en'` if the document has no language.
- Sets the document title to `'Untitled'` if missing, and enables
  `/DisplayDocTitle` in viewer preferences.
- Adds `/MarkInfo` by creating a structure tree if none exists.
- Sets `/Tabs /S` (structure order) on every page.

Returns a result listing what was fixed and what remains unfixable
(e.g. missing alt text, heading skips — those require manual
content changes).

## Parameters

### doc

[`PdfDocument`](../classes/PdfDocument.md)

The PDF document to fix in-place.

## Returns

[`PdfUaEnforcementResult`](../interfaces/PdfUaEnforcementResult.md)

A [PdfUaEnforcementResult](../interfaces/PdfUaEnforcementResult.md) describing what was done.

## Example

```ts
import { createPdf } from 'modern-pdf-lib';
import { enforcePdfUa, validatePdfUa } from 'modern-pdf-lib/accessibility';

const doc = createPdf();
doc.addPage();
const result = enforcePdfUa(doc);
console.log('Fixed:', result.fixed);
console.log('Unfixable:', result.unfixable.length);
```
