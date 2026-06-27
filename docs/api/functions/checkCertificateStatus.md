[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / checkCertificateStatus

# Function: checkCertificateStatus()

```ts
function checkCertificateStatus(
   cert, 
   issuerCert, 
ocspUrl): Promise<OcspResult>;
```

Defined in: [src/signature/ocsp.ts:570](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/ocsp.ts#L570)

Check the revocation status of a certificate using OCSP.

Builds an OCSP request, sends it to the specified OCSP responder
URL via HTTP POST (using `fetch()`), and parses the response.

## Parameters

### cert

`Uint8Array`

DER-encoded certificate to check.

### issuerCert

`Uint8Array`

DER-encoded issuer certificate.

### ocspUrl

`string`

URL of the OCSP responder.

## Returns

`Promise`\&lt;`OcspResult`\&gt;

The OCSP status result.
