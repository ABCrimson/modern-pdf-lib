[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifySignatures

# Function: verifySignatures()

```ts
function verifySignatures(pdfBytes): Promise<SignatureVerificationResult[]>;
```

Defined in: [src/signature/signatureVerifier.ts:338](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L338)

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

`Promise`\&lt;[`SignatureVerificationResult`](../interfaces/SignatureVerificationResult.md)[]\&gt;

Array of verification results.
