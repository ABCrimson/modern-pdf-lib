[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifySignatureDetailed

# Function: verifySignatureDetailed()

```ts
function verifySignatureDetailed(pdf, options?): Promise<DetailedVerificationResult[]>;
```

Defined in: [src/signature/detailedVerifier.ts:548](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/detailedVerifier.ts#L548)

Verify all signatures in a PDF with detailed, structured results.

For each signature found, returns comprehensive information about:
- Integrity verification (ByteRange hash)
- Cryptographic signature validity
- Certificate chain (all certificates in the PKCS#7 structure)
- Revocation status (if `checkRevocation` is enabled)
- Timestamp information
- Diagnostic warnings and errors

## Parameters

### pdf

`Uint8Array`

The PDF file bytes.

### options?

`DetailedVerifyOptions`

Verification options.

## Returns

`Promise`\&lt;`DetailedVerificationResult`[]\&gt;

Array of detailed verification results.

## Example

```ts
const results = await verifySignatureDetailed(pdfBytes, {
  checkRevocation: true,
});
for (const result of results) {
  console.log(`${result.fieldName}: ${result.valid ? 'VALID' : 'INVALID'}`);
  if (result.warnings.length > 0) {
    console.log('Warnings:', result.warnings);
  }
}
```
