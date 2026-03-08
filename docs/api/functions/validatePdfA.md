[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validatePdfA

# Function: validatePdfA()

> **validatePdfA**(`pdfBytes`, `level`): [`PdfAValidationResult`](../interfaces/PdfAValidationResult.md)

Defined in: [src/compliance/pdfA.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/compliance/pdfA.ts#L95)

Validate a PDF against a specific PDF/A conformance level.

This performs structural checks on the raw PDF bytes. It does NOT
fully render or deeply parse the PDF — it checks for the presence
or absence of features that PDF/A requires or forbids.

## Parameters

### pdfBytes

`Uint8Array`

The raw PDF bytes.

### level

[`PdfALevel`](../type-aliases/PdfALevel.md)

The target PDF/A conformance level.

## Returns

[`PdfAValidationResult`](../interfaces/PdfAValidationResult.md)

A validation result with any issues found.
