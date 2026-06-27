[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractOcspUrl

# Function: extractOcspUrl()

```ts
function extractOcspUrl(cert): string | null;
```

Defined in: [src/signature/ocsp.ts:519](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/ocsp.ts#L519)

Extract the OCSP responder URL from a certificate's Authority
Information Access (AIA) extension.

The AIA extension (OID 1.3.6.1.5.5.7.1.1) contains:
```
AuthorityInfoAccessSyntax ::= SEQUENCE OF AccessDescription
AccessDescription ::= SEQUENCE {
  accessMethod    OID,
  accessLocation  GeneralName
}
```

We look for accessMethod = id-ad-ocsp (1.3.6.1.5.5.7.48.1) and
extract the URI from the GeneralName (tag [6] uniformResourceIdentifier).

## Parameters

### cert

`Uint8Array`

DER-encoded X.509 certificate.

## Returns

`string` \| `null`

The OCSP responder URL, or `null` if not found.
