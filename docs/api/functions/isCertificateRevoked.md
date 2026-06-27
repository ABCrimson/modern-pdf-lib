[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / isCertificateRevoked

# Function: isCertificateRevoked()

```ts
function isCertificateRevoked(cert, crl): boolean;
```

Defined in: [src/signature/crl.ts:330](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/crl.ts#L330)

Check if a certificate's serial number appears in a CRL.

Compares the certificate's serial number against all entries
in the CRL's revoked certificates list.

## Parameters

### cert

`Uint8Array`

DER-encoded X.509 certificate to check.

### crl

`CrlData`

Parsed CRL data.

## Returns

`boolean`

`true` if the certificate is listed as revoked.
