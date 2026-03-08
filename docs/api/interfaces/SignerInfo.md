[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignerInfo

# Interface: SignerInfo

Defined in: [src/signature/pkcs7.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/pkcs7.ts#L48)

Information needed to sign a hash.

## Properties

### certificate

> **certificate**: `Uint8Array`

Defined in: [src/signature/pkcs7.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/pkcs7.ts#L50)

DER-encoded X.509 certificate.

***

### hashAlgorithm

> **hashAlgorithm**: `"SHA-256"` \| `"SHA-384"` \| `"SHA-512"`

Defined in: [src/signature/pkcs7.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/pkcs7.ts#L54)

Hash algorithm.

***

### privateKey

> **privateKey**: `Uint8Array`

Defined in: [src/signature/pkcs7.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/2514f232afb2c4adc7dadc80c23b28a0c54e69b6/src/signature/pkcs7.ts#L52)

PKCS#8 DER-encoded private key.
