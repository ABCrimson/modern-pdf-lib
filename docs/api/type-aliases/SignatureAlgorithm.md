[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureAlgorithm

# Type Alias: SignatureAlgorithm

```ts
type SignatureAlgorithm = "RSA" | "ECDSA" | "Ed25519";
```

Defined in: [src/signature/externalSigner.ts:30](https://github.com/ABCrimson/modern-pdf-lib/blob/4c6faf7ea78c1427e7e0b3e77475e1cab1cc8964/src/signature/externalSigner.ts#L30)

Signature algorithm advertised by an [ExternalSigner](../interfaces/ExternalSigner.md).

This describes the key/signature family used by the backend so callers can
select the appropriate certificate and packaging (e.g. PKCS#7 SignerInfo
algorithm identifiers) downstream.
