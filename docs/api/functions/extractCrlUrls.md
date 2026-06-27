[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractCrlUrls

# Function: extractCrlUrls()

```ts
function extractCrlUrls(cert): string[];
```

Defined in: [src/signature/crl.ts:367](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/crl.ts#L367)

Extract CRL Distribution Points URLs from a certificate.

Looks for the CRL Distribution Points extension (OID 2.5.29.31)
and extracts HTTP/LDAP URIs from the DistributionPoint structures.

```
CRLDistributionPoints ::= SEQUENCE OF DistributionPoint
DistributionPoint ::= SEQUENCE {
  distributionPoint [0] DistributionPointName OPTIONAL,
  reasons           [1] ReasonFlags OPTIONAL,
  cRLIssuer         [2] GeneralNames OPTIONAL
}
DistributionPointName ::= CHOICE {
  fullName    [0] GeneralNames,
  nameRelativeToCRLIssuer [1] RelativeDistinguishedName
}
```

## Parameters

### cert

`Uint8Array`

DER-encoded X.509 certificate.

## Returns

`string`[]

Array of CRL URLs found in the certificate.
