[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / validateExtendedKeyUsage

# Function: validateExtendedKeyUsage()

```ts
function validateExtendedKeyUsage(cert, requiredEku): EkuValidationResult;
```

Defined in: [src/signature/certPolicy.ts:487](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/certPolicy.ts#L487)

Validate that a certificate has the required extended key usage OIDs.

Parses the Extended Key Usage extension (OID 2.5.29.37) and checks
that all required EKU OIDs are present.

If the certificate has no EKU extension, the result is `valid: true`
(per RFC 5280, absence means all extended usages are permitted).

The anyExtendedKeyUsage OID (2.5.29.37.0) satisfies all requirements.

## Parameters

### cert

`Uint8Array`

DER-encoded X.509 certificate.

### requiredEku

`string`[]

Array of required EKU OIDs (dotted-decimal).

## Returns

`EkuValidationResult`

Validation result.
