[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getSignatures

# Function: getSignatures()

> **getSignatures**(`pdfBytes`): [`PdfSignatureInfo`](../interfaces/PdfSignatureInfo.md)[]

Defined in: [src/signature/signatureHandler.ts:293](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureHandler.ts#L293)

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
