[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifySignature

# Function: verifySignature()

> **verifySignature**(`pdfBytes`, `byteRange`, `signatureBytes`, `certificateBytes`): `Promise`\<`boolean`\>

Defined in: [src/signature/signatureVerifier.ts:434](https://github.com/ABCrimson/modern-pdf-lib/blob/98bb568db730e691bd6ad27e896102c9bb79cd1c/src/signature/signatureVerifier.ts#L434)

Verify a single signature.

Extracts the signed attributes from the PKCS#7 structure and
verifies the signature using the certificate's public key.

## Parameters

### pdfBytes

`Uint8Array`

The PDF file bytes.

### byteRange

\[`number`, `number`, `number`, `number`\]

The ByteRange array.

### signatureBytes

`Uint8Array`

The DER-encoded PKCS#7 signature.

### certificateBytes

`Uint8Array`

The DER-encoded X.509 certificate.

## Returns

`Promise`\<`boolean`\>

`true` if the signature is valid.
