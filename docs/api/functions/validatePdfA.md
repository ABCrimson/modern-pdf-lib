[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validatePdfA

# Function: validatePdfA()

```ts
function validatePdfA(pdfBytes, level): PdfAValidationResult;
```

Defined in: [src/compliance/pdfA.ts:95](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/compliance/pdfA.ts#L95)

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
