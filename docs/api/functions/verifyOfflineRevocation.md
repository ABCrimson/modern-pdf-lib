[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / verifyOfflineRevocation

# Function: verifyOfflineRevocation()

```ts
function verifyOfflineRevocation(cert, revocationData): OfflineRevocationResult;
```

Defined in: [src/signature/offlineRevocation.ts:271](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/offlineRevocation.ts#L271)

Verify the revocation status of a certificate using only
embedded revocation data (no network access).

Checks OCSP responses first (preferred), then falls back to CRLs.
If no embedded revocation data covers the certificate, returns
status 'no-data'.

## Parameters

### cert

`Uint8Array`

DER-encoded X.509 certificate to check.

### revocationData

`EmbeddedRevocationData`

Embedded revocation data from `extractEmbeddedRevocationData`.

## Returns

`OfflineRevocationResult`

Revocation check result.
