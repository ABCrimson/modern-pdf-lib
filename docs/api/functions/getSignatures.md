[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getSignatures

# Function: getSignatures()

> **getSignatures**(`pdfBytes`): [`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Defined in: [src/signature/signatureHandler.ts:359](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/signatureHandler.ts#L359)

Extract signature information from a PDF.

Scans the PDF for signature dictionaries and extracts metadata
from each one.

## Parameters

### pdfBytes

`Uint8Array`

The PDF file bytes.

## Returns

[`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Array of signature info objects.
