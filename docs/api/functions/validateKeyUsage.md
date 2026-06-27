[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateKeyUsage

# Function: validateKeyUsage()

```ts
function validateKeyUsage(cert, requiredUsage): KeyUsageValidationResult;
```

Defined in: [src/signature/certPolicy.ts:435](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/certPolicy.ts#L435)

Validate that a certificate has the required key usage flags.

Parses the Key Usage extension (OID 2.5.29.15) from the certificate
and checks that all required flags are present.

If the certificate has no Key Usage extension, the result is
`valid: true` with empty presentFlags (per RFC 5280, the absence
of the extension means all usages are permitted).

## Parameters

### cert

`Uint8Array`

DER-encoded X.509 certificate.

### requiredUsage

`KeyUsageFlag`[]

Array of required key usage flags.

## Returns

`KeyUsageValidationResult`

Validation result.
