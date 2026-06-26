[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / buildPdfX6OutputIntent

# Function: buildPdfX6OutputIntent()

```ts
function buildPdfX6OutputIntent(options): PdfDict;
```

Defined in: [src/compliance/pdfX6.ts:82](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfX6.ts#L82)

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
