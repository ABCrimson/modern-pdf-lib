[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / CounterSignatureInfo

# Interface: CounterSignatureInfo

Defined in: [src/signature/counterSignature.ts:44](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/counterSignature.ts#L44)

Information about a counter-signature found on a PDF signature.

## Properties

### isValid

> **isValid**: `boolean`

Defined in: [src/signature/counterSignature.ts:52](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/counterSignature.ts#L52)

Whether the counter-signature is structurally valid.

***

### signedAt?

> `optional` **signedAt?**: `Date`

Defined in: [src/signature/counterSignature.ts:50](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/counterSignature.ts#L50)

When the counter-signature was applied.

***

### signerName

> **signerName**: `string`

Defined in: [src/signature/counterSignature.ts:48](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/counterSignature.ts#L48)

The Common Name of the counter-signer.

***

### targetSignatureIndex

> **targetSignatureIndex**: `number`

Defined in: [src/signature/counterSignature.ts:46](https://github.com/ABCrimson/modern-pdf-lib/blob/539dbdf3be4c0bc676699d4c8969d4330c935cec/src/signature/counterSignature.ts#L46)

The index of the primary signature that was counter-signed.
