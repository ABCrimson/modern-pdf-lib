[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / findExistingSignatures

# Function: findExistingSignatures()

> **findExistingSignatures**(`pdf`): [`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Defined in: [src/signature/incrementalSave.ts:142](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/incrementalSave.ts#L142)

Scan a PDF for all /Type /Sig dictionaries and extract their byte ranges.

## Parameters

### pdf

`Uint8Array`

The PDF bytes to scan.

## Returns

[`SignatureByteRange`](../interfaces/SignatureByteRange.md)[]

Array of signature byte range descriptors.
