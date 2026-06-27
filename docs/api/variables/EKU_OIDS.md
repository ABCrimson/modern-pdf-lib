[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / EKU\_OIDS

# Variable: EKU\_OIDS

```ts
const EKU_OIDS: object;
```

Defined in: [src/signature/certPolicy.ts:119](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/certPolicy.ts#L119)

Well-known Extended Key Usage OIDs.

## Type Declaration

### adobeAuthenticDocument

```ts
readonly adobeAuthenticDocument: "1.2.840.113583.1.1.5" = '1.2.840.113583.1.1.5';
```

Adobe authentic document (PDF signing)

### anyExtendedKeyUsage

```ts
readonly anyExtendedKeyUsage: "2.5.29.37.0" = '2.5.29.37.0';
```

anyExtendedKeyUsage

### clientAuth

```ts
readonly clientAuth: "1.3.6.1.5.5.7.3.2" = '1.3.6.1.5.5.7.3.2';
```

id-kp-clientAuth (TLS client)

### codeSigning

```ts
readonly codeSigning: "1.3.6.1.5.5.7.3.3" = '1.3.6.1.5.5.7.3.3';
```

id-kp-codeSigning

### emailProtection

```ts
readonly emailProtection: "1.3.6.1.5.5.7.3.4" = '1.3.6.1.5.5.7.3.4';
```

id-kp-emailProtection (S/MIME)

### msDocumentSigning

```ts
readonly msDocumentSigning: "1.3.6.1.4.1.311.10.3.12" = '1.3.6.1.4.1.311.10.3.12';
```

Microsoft document signing

### ocspSigning

```ts
readonly ocspSigning: "1.3.6.1.5.5.7.3.9" = '1.3.6.1.5.5.7.3.9';
```

id-kp-OCSPSigning (OCSP responder)

### serverAuth

```ts
readonly serverAuth: "1.3.6.1.5.5.7.3.1" = '1.3.6.1.5.5.7.3.1';
```

id-kp-serverAuth (TLS server)

### timeStamping

```ts
readonly timeStamping: "1.3.6.1.5.5.7.3.8" = '1.3.6.1.5.5.7.3.8';
```

id-kp-timeStamping (RFC 3161 TSA)
