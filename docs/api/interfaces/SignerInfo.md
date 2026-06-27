[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignerInfo

# Interface: SignerInfo

Defined in: [src/signature/pkcs7.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/pkcs7.ts#L48)

Information needed to sign a hash.

## Properties

### certificate

```ts
certificate: Uint8Array;
```

Defined in: [src/signature/pkcs7.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/pkcs7.ts#L50)

DER-encoded X.509 certificate.

***

### hashAlgorithm

```ts
hashAlgorithm: "SHA-256" | "SHA-384" | "SHA-512";
```

Defined in: [src/signature/pkcs7.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/pkcs7.ts#L54)

Hash algorithm.

***

### privateKey

```ts
privateKey: Uint8Array;
```

Defined in: [src/signature/pkcs7.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/pkcs7.ts#L52)

PKCS#8 DER-encoded private key.
