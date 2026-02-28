[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureVerificationResult

# Interface: SignatureVerificationResult

Defined in: [src/signature/signatureVerifier.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L44)

Result of verifying a single signature.

## Properties

### certificateValid?

> `optional` **certificateValid**: `boolean`

Defined in: [src/signature/signatureVerifier.ts:56](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L56)

Whether the cryptographic signature is valid.

***

### fieldName

> **fieldName**: `string`

Defined in: [src/signature/signatureVerifier.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L46)

The signature field name.

***

### integrityValid

> **integrityValid**: `boolean`

Defined in: [src/signature/signatureVerifier.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L54)

Whether the ByteRange hash matches the signed hash.

***

### reason?

> `optional` **reason**: `string`

Defined in: [src/signature/signatureVerifier.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L52)

Reason for signing (if present).

***

### signedBy

> **signedBy**: `string`

Defined in: [src/signature/signatureVerifier.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L48)

Subject CN from the certificate.

***

### signingDate?

> `optional` **signingDate**: `Date`

Defined in: [src/signature/signatureVerifier.ts:58](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L58)

Signing date (if present in signed attributes).

***

### valid

> **valid**: `boolean`

Defined in: [src/signature/signatureVerifier.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/eaf6da317b4ede08cfb64242ea1db66c2fb5d945/src/signature/signatureVerifier.ts#L50)

Overall validity (integrity AND signature).
