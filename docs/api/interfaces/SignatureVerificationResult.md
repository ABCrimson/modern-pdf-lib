[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureVerificationResult

# Interface: SignatureVerificationResult

Defined in: [src/signature/signatureVerifier.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L44)

Result of verifying a single signature.

## Properties

### certificateValid?

```ts
optional certificateValid?: boolean;
```

Defined in: [src/signature/signatureVerifier.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L56)

Whether the cryptographic signature is valid.

***

### fieldName

```ts
fieldName: string;
```

Defined in: [src/signature/signatureVerifier.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L46)

The signature field name.

***

### integrityValid

```ts
integrityValid: boolean;
```

Defined in: [src/signature/signatureVerifier.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L54)

Whether the ByteRange hash matches the signed hash.

***

### reason?

```ts
optional reason?: string;
```

Defined in: [src/signature/signatureVerifier.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L52)

Reason for signing (if present).

***

### signedBy

```ts
signedBy: string;
```

Defined in: [src/signature/signatureVerifier.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L48)

Subject CN from the certificate.

***

### signingDate?

```ts
optional signingDate?: Date;
```

Defined in: [src/signature/signatureVerifier.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L58)

Signing date (if present in signed attributes).

***

### valid

```ts
valid: boolean;
```

Defined in: [src/signature/signatureVerifier.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/41e38d3cdf2c93941dd206dd1bfad0f001b30727/src/signature/signatureVerifier.ts#L50)

Overall validity (integrity AND signature).
