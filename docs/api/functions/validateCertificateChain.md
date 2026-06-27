[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateCertificateChain

# Function: validateCertificateChain()

```ts
function validateCertificateChain(chain, options?): Promise<ChainValidationResult>;
```

Defined in: [src/signature/chainValidator.ts:531](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/chainValidator.ts#L531)

Validate a certificate chain.

Checks each certificate in the chain for:
1. **Signature verification** — the issuer's public key verifies
   the signature on the subject certificate.
2. **Validity period** — the certificate is within its notBefore
   and notAfter dates at the validation time.
3. **Basic constraints** — intermediate/root certificates have
   the CA flag set in the BasicConstraints extension.

## Parameters

### chain

`Uint8Array`\&lt;`ArrayBufferLike`\&gt;[]

Ordered array of DER-encoded certificates (leaf first, root last).

### options?

`ChainValidationOptions`

Validation options.

## Returns

`Promise`\&lt;`ChainValidationResult`\&gt;

Validation result with per-certificate status.
