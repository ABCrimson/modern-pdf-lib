[**modern-pdf-lib**](../index.md)

***

[modern-pdf-lib](../index.md) / SignatureChainEntry

# Interface: SignatureChainEntry

Defined in: [src/signature/multiSignatureValidator.ts:29](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/multiSignatureValidator.ts#L29)

Validation status for a single signature in the chain.

## Properties

### byteRange

> **byteRange**: \[`number`, `number`, `number`, `number`\]

Defined in: [src/signature/multiSignatureValidator.ts:37](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/multiSignatureValidator.ts#L37)

The byte range covering this signature.

***

### coversEntireDocument

> **coversEntireDocument**: `boolean`

Defined in: [src/signature/multiSignatureValidator.ts:39](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/multiSignatureValidator.ts#L39)

Whether this signature covers the entire document up to its point.

***

### fieldName

> **fieldName**: `string`

Defined in: [src/signature/multiSignatureValidator.ts:31](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/multiSignatureValidator.ts#L31)

The signature field name (extracted from /T).

***

### signedAt?

> `optional` **signedAt**: `Date`

Defined in: [src/signature/multiSignatureValidator.ts:35](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/multiSignatureValidator.ts#L35)

The signing date (extracted from /M), if present.

***

### signerName

> **signerName**: `string`

Defined in: [src/signature/multiSignatureValidator.ts:33](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/multiSignatureValidator.ts#L33)

The signer name (extracted from /Contents PKCS#7 or dictionary).

***

### status

> **status**: `"valid"` \| `"invalid"` \| `"broken_chain"`

Defined in: [src/signature/multiSignatureValidator.ts:41](https://github.com/ABCrimson/modern-pdf-lib/blob/c9a6cf208b5db5d88cc08a5d539f2a20bff9d3c4/src/signature/multiSignatureValidator.ts#L41)

Validation status for this entry in the chain.
