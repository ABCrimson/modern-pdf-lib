[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / getSignatures

# Function: getSignatures()

```ts
function getSignatures(pdfBytes): PdfSignatureInfo[];
```

Defined in: [src/signature/signatureHandler.ts:359](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/signatureHandler.ts#L359)

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
