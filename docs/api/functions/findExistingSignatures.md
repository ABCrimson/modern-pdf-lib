[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findExistingSignatures

# Function: findExistingSignatures()

> **findExistingSignatures**(`pdf`): [`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Defined in: [src/signature/incrementalSave.ts:165](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/incrementalSave.ts#L165)

Scan a PDF for all /Type /Sig dictionaries and extract their byte ranges.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to scan.

## Returns

[`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Array of signature byte range descriptors.
