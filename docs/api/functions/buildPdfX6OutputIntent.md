[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPdfX6OutputIntent

# Function: buildPdfX6OutputIntent()

> **buildPdfX6OutputIntent**(`options`): [`PdfDict`](../classes/PdfDict.md)

Defined in: src/compliance/pdfX6.ts:82

Build a PDF/X-6 output-intent dictionary.

The returned dictionary uses the `/GTS_PDFX` output-intent subtype required
by all PDF/X families. The caller is responsible for attaching an embedded
ICC profile stream under `/DestOutputProfile` (for `PDF/X-6` / `PDF/X-6n`)
and adding the dictionary to the catalog `/OutputIntents` array.

## Parameters

### options

[`PdfX6Options`](../interfaces/PdfX6Options.md)

Output-intent identification.

## Returns

[`PdfDict`](../classes/PdfDict.md)

A freshly-built `/Type /OutputIntent` dictionary.
