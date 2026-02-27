[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignOptions

# Interface: SignOptions

Defined in: [src/signature/signatureHandler.ts:25](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L25)

Options for signing a PDF.

## Properties

### certificate

> **certificate**: `Uint8Array`

Defined in: [src/signature/signatureHandler.ts:27](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L27)

DER-encoded X.509 certificate.

***

### contactInfo?

> `optional` **contactInfo**: `string`

Defined in: [src/signature/signatureHandler.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L37)

Contact information.

***

### hashAlgorithm?

> `optional` **hashAlgorithm**: `"SHA-256"` \| `"SHA-384"` \| `"SHA-512"`

Defined in: [src/signature/signatureHandler.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L31)

Hash algorithm. Default: 'SHA-256'.

***

### location?

> `optional` **location**: `string`

Defined in: [src/signature/signatureHandler.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L35)

Location of signing.

***

### privateKey

> **privateKey**: `Uint8Array`

Defined in: [src/signature/signatureHandler.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L29)

PKCS#8 DER-encoded private key.

***

### reason?

> `optional` **reason**: `string`

Defined in: [src/signature/signatureHandler.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L33)

Reason for signing.

***

### timestampUrl?

> `optional` **timestampUrl**: `string`

Defined in: [src/signature/signatureHandler.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/86f43cf3bcfc43d27d02f37979dfabd9921b66bc/src/signature/signatureHandler.ts#L39)

RFC 3161 TSA URL for timestamping (optional).
