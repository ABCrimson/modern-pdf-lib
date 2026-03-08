[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CounterSignatureInfo

# Interface: CounterSignatureInfo

Defined in: [src/signature/counterSignature.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/counterSignature.ts#L46)

Information about a counter-signature found on a PDF signature.

## Properties

### isValid

> **isValid**: `boolean`

Defined in: [src/signature/counterSignature.ts:54](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/counterSignature.ts#L54)

Whether the counter-signature is structurally valid.

***

### signedAt?

> `optional` **signedAt**: `Date`

Defined in: [src/signature/counterSignature.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/counterSignature.ts#L52)

When the counter-signature was applied.

***

### signerName

> **signerName**: `string`

Defined in: [src/signature/counterSignature.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/counterSignature.ts#L50)

The Common Name of the counter-signer.

***

### targetSignatureIndex

> **targetSignatureIndex**: `number`

Defined in: [src/signature/counterSignature.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/counterSignature.ts#L48)

The index of the primary signature that was counter-signed.
