[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifySignatures

# Function: verifySignatures()

> **verifySignatures**(`pdfBytes`): `Promise`\<[`SignatureVerificationResult`](../interfaces/SignatureVerificationResult.md)[]\>

Defined in: [src/signature/signatureVerifier.ts:338](https://github.com/ABCrimson/modern-pdf-lib/blob/1107c69291c62f8be5758332cc1e4fd66930b306/src/signature/signatureVerifier.ts#L338)

Verify all signatures in a PDF.

For each signature found:
1. Computes the hash of the ByteRange-covered bytes
2. Extracts the PKCS#7 structure
3. Verifies the message digest matches
4. Verifies the cryptographic signature against the certificate

## Parameters

### pdfBytes

`Uint8Array`

The PDF file bytes.

## Returns

`Promise`\<[`SignatureVerificationResult`](../interfaces/SignatureVerificationResult.md)[]\>

Array of verification results.
