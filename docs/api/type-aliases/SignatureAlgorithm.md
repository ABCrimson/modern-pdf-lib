[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureAlgorithm

# Type Alias: SignatureAlgorithm

```ts
type SignatureAlgorithm = "RSA" | "ECDSA" | "Ed25519";
```

Defined in: [src/signature/externalSigner.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/externalSigner.ts#L30)

Signature algorithm advertised by an [ExternalSigner](../interfaces/ExternalSigner.md).

This describes the key/signature family used by the backend so callers can
select the appropriate certificate and packaging (e.g. PKCS#7 SignerInfo
algorithm identifiers) downstream.
