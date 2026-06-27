[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateCertificatePolicy

# Function: validateCertificatePolicy()

```ts
function validateCertificatePolicy(cert, options?): PolicyValidationResult;
```

Defined in: [src/signature/certPolicy.ts:546](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/certPolicy.ts#L546)

Perform comprehensive certificate policy validation.

Checks:
1. Key usage flags (digitalSignature and/or nonRepudiation)
2. Extended key usage (if present)
3. Validity period (notBefore/notAfter)
4. Basic Constraints (CA flag)

## Parameters

### cert

`Uint8Array`

DER-encoded X.509 certificate.

### options?

`PolicyValidationOptions`

Validation options.

## Returns

`PolicyValidationResult`

Comprehensive validation result.
