[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findExistingSignatures

# Function: findExistingSignatures()

> **findExistingSignatures**(`pdf`): [`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Defined in: [src/signature/incrementalSave.ts:165](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/incrementalSave.ts#L165)

Scan a PDF for all /Type /Sig dictionaries and extract their byte ranges.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to scan.

## Returns

[`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Array of signature byte range descriptors.
