[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / extractEmbeddedRevocationData

# Function: extractEmbeddedRevocationData()

```ts
function extractEmbeddedRevocationData(signatureBytes): EmbeddedRevocationData;
```

Defined in: [src/signature/offlineRevocation.ts:180](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/offlineRevocation.ts#L180)

Extract embedded revocation data (CRLs and OCSP responses) from
a DER-encoded PKCS#7/CMS signature.

Searches both signed and unsigned attributes for:
- adbe-revocationInfoArchival (OID 1.2.840.113583.1.1.8)
- id-smime-aa-ets-revocationRefs / revocationValues

## Parameters

### signatureBytes

`Uint8Array`

DER-encoded PKCS#7 signature bytes.

## Returns

`EmbeddedRevocationData`

Extracted CRLs and OCSP responses.
