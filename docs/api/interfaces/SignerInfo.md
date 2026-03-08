[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignerInfo

# Interface: SignerInfo

Defined in: [src/signature/pkcs7.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/pkcs7.ts#L48)

Information needed to sign a hash.

## Properties

### certificate

> **certificate**: `Uint8Array`

Defined in: [src/signature/pkcs7.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/pkcs7.ts#L50)

DER-encoded X.509 certificate.

***

### hashAlgorithm

> **hashAlgorithm**: `"SHA-256"` \| `"SHA-384"` \| `"SHA-512"`

Defined in: [src/signature/pkcs7.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/pkcs7.ts#L54)

Hash algorithm.

***

### privateKey

> **privateKey**: `Uint8Array`

Defined in: [src/signature/pkcs7.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/24d045852a3d92d1265ead3e87177fbe27aaafc9/src/signature/pkcs7.ts#L52)

PKCS#8 DER-encoded private key.
