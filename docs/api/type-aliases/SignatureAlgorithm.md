[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureAlgorithm

# Type Alias: SignatureAlgorithm

> **SignatureAlgorithm** = `"RSA"` \| `"ECDSA"` \| `"Ed25519"`

Defined in: src/signature/externalSigner.ts:30

Signature algorithm advertised by an [ExternalSigner](../interfaces/ExternalSigner.md).

This describes the key/signature family used by the backend so callers can
select the appropriate certificate and packaging (e.g. PKCS#7 SignerInfo
algorithm identifiers) downstream.
